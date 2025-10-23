const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const AdmZip = require('adm-zip');
const tar = require('tar');

const projectDir = process.cwd();

const dockerConfigDir = path.join(projectDir, '.docker-empty');

const trivyDir = path.resolve('tools/trivy');
const trivyConfig = path.resolve('trivy.yaml');
let trivyBin;
const trivyVersion = '0.66.0';
const cacheDir = path.join(process.cwd(), '.cache', 'trivy');
const dbArchive = path.join(process.cwd(), 'db.tar.gz');
const dbPath = path.join(cacheDir, 'db', 'trivy.db');
const colorMap = {
  CRITICAL: '\x1b[31m',
  HIGH: '\x1b[33m',
  MEDIUM: '\x1b[34m',
  LOW: '\x1b[32m',
};
const reset = '\x1b[0m';
function promisifyTar(fn, options, files = []) {
  return new Promise((resolve, reject) => {
    fn(options, files, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function downloadFile(url, dest, label = 'Download', maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl, redirectsLeft) => {
      https
        .get(
          currentUrl,
          {
            followRedirect: false,
            headers: {
              'User-Agent': 'trivy-scan-script',
              Accept: '*/*',
            },
          },
          (response) => {
            const statusCode = response.statusCode;

            if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
              if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
              let redirectUrl = response.headers.location;
              if (redirectUrl.startsWith('/')) {
                const baseUrl = new URL(currentUrl);
                redirectUrl = `${baseUrl.protocol}//${baseUrl.host}${redirectUrl}`;
              }
              return doRequest(redirectUrl, redirectsLeft - 1);
            }

            if (statusCode !== 200) {
              let errorMessage = `Download failed: ${statusCode}`;
              if (response.headers.location)
                errorMessage += ` (redirect to ${response.headers.location})`;
              return reject(new Error(errorMessage));
            }

            const total = parseInt(response.headers['content-length'] || '0', 10);
            let received = 0;
            let lastLogged = 0;

            const file = fs.createWriteStream(dest);
            response.on('data', (chunk) => {
              received += chunk.length;
              const now = Date.now();
              if (now - lastLogged > 120) {
                lastLogged = now;
                if (total > 0) {
                  const pct = ((received / total) * 100).toFixed(1);
                  process.stdout.write(`\r${label}: ${pct}%`);
                } else {
                  process.stdout.write(`\r${label}: ${Math.round(received / 1024 / 1024)} MB`);
                }
              }
            });

            response.pipe(file);
            file.on('finish', () => {
              file.close(() => {
                if (total > 0) process.stdout.write(`\r${label}: 100.0%\n`);
                else process.stdout.write(`\r${label}: done\n`);
                resolve();
              });
            });
            file.on('error', (err) => {
              try {
                fs.unlinkSync(dest);
              } catch {}
              reject(err);
            });
          }
        )
        .on('error', (err) => {
          try {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
          } catch {}
          reject(err);
        });
    };

    doRequest(url, maxRedirects);
  });
}

async function ensureTrivy() {
  const binName = os.platform() === 'win32' ? 'trivy.exe' : 'trivy';
  trivyBin = path.join(trivyDir, binName);

  if (fs.existsSync(trivyBin)) {
    console.log('✅ Trivy already installed');
    return;
  }

  if (!fs.existsSync(trivyDir)) fs.mkdirSync(trivyDir, { recursive: true });

  const platformMap = {
    win32: { name: 'Windows-64bit', ext: '.zip' },
    linux: { name: 'Linux-64bit', ext: '.tar.gz' },
    darwin: { name: 'macOS-64bit', ext: '.tar.gz' },
  };
  const platformInfo = platformMap[os.platform()];
  if (!platformInfo) throw new Error(`❌ Unsupported platform: ${os.platform()}`);

  const fileName = `trivy_${trivyVersion}_${platformInfo.name}${platformInfo.ext}`;
  const url = `https://github.com/aquasecurity/trivy/releases/download/v${trivyVersion}/${fileName}`;
  const outPath = path.join(trivyDir, fileName);

  try {
    await downloadFile(url, outPath, `Downloading Trivy (${fileName})`);
  } catch (err) {
    console.error(`❌ Failed to download Trivy: ${err.message}`);
    throw err;
  }

  console.log(`🧩 Extracting ${fileName}…`);
  if (platformInfo.ext === '.zip') {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Avoid EBUSY on Windows
    const zip = new AdmZip(outPath);
    zip.extractAllTo(trivyDir, true);
  } else {
    execSync(`tar -xzf "${outPath}" -C "${trivyDir}"`, { stdio: 'inherit' });
  }

  try {
    fs.unlinkSync(outPath);
  } catch {}

  if (os.platform() !== 'win32') {
    execSync(`chmod +x "${trivyBin}"`, { stdio: 'inherit' });
  }

  console.log(`🚀 Trivy installed at: ${trivyBin}`);
}

// Run Trivy scan
function runTrivy(scanType, target, outputFile, skipDbUpdate = true) {
  console.log(`🚀 Running Trivy ${scanType} scan on ${target}…`);
  let args = [
    scanType,
    '--quiet',
    '--config',
    trivyConfig,
    '--format',
    'json',
    '-o',
    outputFile,
    target,
  ];

  if (skipDbUpdate && ['fs', 'image', 'repo'].includes(scanType)) {
    args.splice(2, 0, '--skip-db-update', '--skip-java-db-update');
  }

  try {
    fs.mkdirSync(dockerConfigDir, { recursive: true });
    require('child_process').execFileSync(trivyBin, args, {
      stdio: 'inherit',
      env: { ...process.env, DOCKER_CONFIG: dockerConfigDir, TRIVY_CACHE_DIR: cacheDir },
    });
    console.log(`✅ ${scanType} scan complete → ${outputFile}`);
    return true;
  } catch (err) {
    console.error(`❌ ${scanType} scan failed: ${err.message}`);
    console.error(`Command: ${trivyBin} ${args.map((a) => JSON.stringify(a)).join(' ')}`);
    return false;
  }
}

function processReport(jsonFile, mdFile) {
  if (!fs.existsSync(jsonFile)) {
    console.log(`⚠️  Skipping report processing: ${jsonFile} not found`);
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    let markdown = `# Trivy Detailed Report\n\n**Source:** ${path.basename(jsonFile)}\n\n`;
    let totalMisconfigs = 0;
    let totalVulns = 0;
    let totalSecrets = 0;

    console.log(`\n📊 Processing report: ${path.basename(jsonFile)}`);

    (data.Results || []).forEach((result) => {
      const target = result.Target || 'Unknown Target';
      console.log(`\n🖥️  Target: ${target}`);
      markdown += `## 🖥️ Target: ${target}\n\n`;

      if (result.Misconfigurations?.length) {
        totalMisconfigs += result.Misconfigurations.length;
        console.log(`🔐 ${result.Misconfigurations.length} Misconfigurations found`);
        markdown += `### 🔐 Misconfigurations (${result.Misconfigurations.length})\n\n`;
        result.Misconfigurations.forEach((m) => {
          let code = (m.ID || '').toUpperCase().replace(/^AVD-/, '').replace(/-/g, '');
          const info = MISCONFIG_MAP[code];
          if (info) {
            console.log(`❌ [${code}] ${info.title}`);
            console.log(`   📖 Why: ${info.why}`);
            console.log(`   🛠️ Fix:\n${info.fix}`);
            console.log(`   🔗 Reference: ${info.ref}\n`);

            markdown += `- **[${code}] ${info.title}**\n`;
            markdown += `  - Why: ${info.why}\n`;
            markdown += `  - Fix:\n\`\`\`yaml\n${info.fix}\n\`\`\`\n`;
            markdown += `  - Reference: [${info.ref}](${info.ref})\n\n`;
          } else {
            console.log(`❌ [${code}] ${m.Title || 'Unknown Misconfiguration'}`);
            if (m.PrimaryURL) console.log(`   🔗 More info: ${m.PrimaryURL}`);

            markdown += `- **[${code}] ${m.Title || 'Unknown Misconfiguration'}**\n`;
            if (m.PrimaryURL) markdown += `  - More info: [Link](${m.PrimaryURL})\n`;
            markdown += `\n`;
          }
        });
      } else {
        console.log('✅ No misconfigurations found');
      }

      if (result.Vulnerabilities?.length) {
        totalVulns += result.Vulnerabilities.length;
        console.log(`📦 ${result.Vulnerabilities.length} Vulnerabilities found`);
        result.Vulnerabilities.forEach((v) => {
          const color = colorMap[v.Severity] || reset;
          console.log(
            `${color}- ${v.VulnerabilityID} in ${v.PkgName} ${v.InstalledVersion} → ${v.FixedVersion || 'unfixed'}${reset}`
          );
          if (v.PrimaryURL) console.log(`  🔗 ${v.PrimaryURL}`);
        });
      }

      if (result.Secrets?.length) {
        totalSecrets += result.Secrets.length;
        console.log(`🕵️  ${result.Secrets.length} Secrets detected`);
        result.Secrets.forEach((s) => {
          const color = { CRITICAL: '\x1b[31m', HIGH: '\x1b[33m' }[s.Severity] || reset;
          console.log(
            `${color}- ${s.RuleID} at line ${s.StartLine} → Remove/rotate immediately!${reset}`
          );
        });
      }
    });

    console.log(`\n📈 Summary for ${path.basename(jsonFile)}:`);
    console.log(`   Misconfigurations: ${totalMisconfigs}`);
    console.log(`   Vulnerabilities: ${totalVulns}`);
    console.log(`   Secrets: ${totalSecrets}`);
    if (totalMisconfigs + totalVulns + totalSecrets === 0) {
      console.log('🎉 Clean scan! No issues found for ${sourceLabel}.');
    }

    fs.writeFileSync(mdFile, markdown, 'utf8');
    console.log(`📄 Markdown report generated → ${mdFile}`);
  } catch (err) {
    console.error(`❌ Failed to process report ${jsonFile}: ${err.message}`);
  }
}

async function downloadDbViaTrivy() {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(dockerConfigDir, { recursive: true });
    } catch {}
    console.log(
      '▶️  trivy image --download-db-only (using TRIVY_CACHE_DIR + DOCKER_CONFIG override)'
    );

    const child = spawn(trivyBin, ['image', '--download-db-only'], {
      env: { ...process.env, TRIVY_CACHE_DIR: cacheDir, DOCKER_CONFIG: dockerConfigDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let lastPct = -1;
    const onChunk = (buf) => {
      const text = buf.toString();
      const matches = text.match(/(\d{1,3}(?:\.\d+)?)%/g);
      if (matches && matches.length) {
        const pct = parseFloat(matches[matches.length - 1].replace('%', ''));
        if (!Number.isNaN(pct) && pct !== lastPct) {
          lastPct = pct;
          process.stdout.write(`\rDB download: ${pct.toFixed(1)}%`);
        }
      }
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (lastPct >= 0 && lastPct < 100) process.stdout.write(`\rDB download: 100.0%\n`);
      else if (lastPct >= 100) process.stdout.write(`\rDB download: ${lastPct.toFixed(1)}%\n`);
      code === 0 ? resolve() : reject(new Error(`Trivy DB download exited with code ${code}`));
    });
  });
}

function runTrivyJson(scanType, target, skipDbUpdate = true) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running Trivy ${scanType} scan on ${target}…`);
    const args = [scanType, '--quiet', '--config', trivyConfig, '--format', 'json'];
    if (skipDbUpdate && ['fs', 'image', 'repo'].includes(scanType)) {
      args.splice(1, 0, '--skip-db-update', '--skip-java-db-update');
    }
    args.push(target);

    fs.mkdirSync(dockerConfigDir, { recursive: true });
    const child = spawn(trivyBin, args, {
      env: { ...process.env, DOCKER_CONFIG: dockerConfigDir, TRIVY_CACHE_DIR: cacheDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => process.stderr.write(d));

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Trivy exited with code ${code}`));
      try {
        resolve(JSON.parse(out || '{}'));
      } catch (e) {
        reject(new Error(`Failed to parse Trivy JSON: ${e.message}`));
      }
    });
  });
}

function processReportData(data, sourceLabel = 'scan') {
  console.log(`\n📊 Results: ${sourceLabel}`);

  let totalMisconfigs = 0;
  let totalVulns = 0;
  let totalSecrets = 0;

  (data.Results || []).forEach((result) => {
    const target = result.Target || 'Unknown Target';
    console.log(`\n🖥️  Target: ${target}`);

    if (result.Misconfigurations?.length) {
      totalMisconfigs += result.Misconfigurations.length;
      console.log(`🔐 ${result.Misconfigurations.length} Misconfigurations found`);
      result.Misconfigurations.forEach((m) => {
        let code = (m.ID || '').toUpperCase().replace(/^AVD-/, '').replace(/-/g, '');
        const info = MISCONFIG_MAP[code];
        if (info) {
          console.log(`❌ [${code}] ${info.title}`);
          console.log(`   📖 Why: ${info.why}`);
          console.log(`   🛠️ Fix:\n${info.fix}`);
          console.log(`   🔗 Reference: ${info.ref}\n`);
        } else {
          console.log(`❌ [${code}] ${m.Title || 'Unknown Misconfiguration'}`);
          if (m.PrimaryURL) console.log(`   🔗 More info: ${m.PrimaryURL}`);
        }
      });
    } else {
      console.log('✅ No misconfigurations found');
    }

    if (result.Vulnerabilities?.length) {
      totalVulns += result.Vulnerabilities.length;
      console.log(`📦 ${result.Vulnerabilities.length} Vulnerabilities found`);
      result.Vulnerabilities.forEach((v) => {
        const color = colorMap[v.Severity] || reset;
        console.log(
          `${color}- ${v.VulnerabilityID} in ${v.PkgName} ${v.InstalledVersion} → ${v.FixedVersion || 'unfixed'}${reset}`
        );
        if (v.PrimaryURL) console.log(`  🔗 ${v.PrimaryURL}`);
      });
    } else {
      console.log('✅ No vulnerabilities found');
    }

    if (result.Secrets?.length) {
      totalSecrets += result.Secrets.length;
      console.log(`🕵️  ${result.Secrets.length} Secrets detected`);
      result.Secrets.forEach((s) => {
        const color = { CRITICAL: '\x1b[31m', HIGH: '\x1b[33m' }[s.Severity] || reset;
        console.log(
          `${color}- ${s.RuleID} at line ${s.StartLine} → Remove/rotate immediately!${reset}`
        );
      });
    } else {
      console.log('✅ No secrets found');
    }
  });

  console.log(`\n📈 Summary for ${sourceLabel}:`);
  console.log(`   Misconfigurations: ${totalMisconfigs}`);
  console.log(`   Vulnerabilities: ${totalVulns}`);
  console.log(`   Secrets: ${totalSecrets}`);
  if (totalMisconfigs + totalVulns + totalSecrets === 0) {
    console.log(`🎉 Clean scan! No issues found for ${sourceLabel}.`);
  }

  return {
    misconfigurations: totalMisconfigs,
    vulnerabilities: totalVulns,
    secrets: totalSecrets,
    total: totalMisconfigs + totalVulns + totalSecrets,
  };
}

const MISCONFIG_MAP = {
  KSV1: {
    title: 'Privileged mode not dropped',
    why: 'Container might run with elevated privileges.',
    fix: `    securityContext:\n  allowPrivilegeEscalation: false\n  privileged: false`,
    ref: 'https://avd.aquasec.com/misconfig/ksv001',
  },
  KSV12: {
    title: 'Linux capabilities not dropped',
    why: 'Containers inherit kernel capabilities that may allow sensitive operations.',
    fix: `    securityContext:\n  capabilities:\n    drop:\n      - ALL`,
    ref: 'https://avd.aquasec.com/misconfig/ksv012',
  },
  KSV13: {
    title: 'Missing runAsNonRoot',
    why: 'Container is running as root.',
    fix: `    securityContext:\n  runAsNonRoot: true\n  runAsUser: 1000`,
    ref: 'https://avd.aquasec.com/misconfig/ksv013',
  },
  KSV014: {
    title: 'Writable root filesystem',
    why: 'Root filesystem is writable.',
    fix: `    securityContext:\n  readOnlyRootFilesystem: true`,
    ref: 'https://avd.aquasec.com/misconfig/ksv014',
  },
  KSV104: {
    title: 'Unsafe hostPath volume',
    why: 'Pod mounts host filesystem directly.',
    fix: `    volumes:\n- name: my-volume\n  hostPath:\n    path: /data/app\n    type: DirectoryOrCreate`,
    ref: 'https://avd.aquasec.com/misconfig/ksv104',
  },
  KSV118: {
    title: 'Default security context configured',
    why: 'Workload relies on default securityContext which may allow root user, privilege escalation, writable root filesystem, and broad capabilities.',
    fix: `# Pod-level recommended defaults
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
# Container-level hardening
containers:
  - name: <your-container>
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL`,
    ref: 'https://avd.aquasec.com/misconfig/ksv118',
  },
};

function processMisconfigOnly(jsonFile, mdFile) {
  if (!fs.existsSync(jsonFile)) {
    console.log(`⚠️  Skipping misconfig report: ${jsonFile} not found`);
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    let markdown = `# Trivy Misconfigurations Report\n\n**Source:** ${path.basename(jsonFile)}\n\n`;
    let misconfigsTotal = 0;

    (data.Results || []).forEach((result) => {
      const target = result.Target || 'Unknown Target';
      const list = result.Misconfigurations || [];
      if (!list.length) return;

      markdown += `## 🖥️ Target: ${target}\n\n`;
      markdown += `### 🔐 Misconfigurations (${list.length})\n\n`;
      misconfigsTotal += list.length;

      list.forEach((m) => {
        const code = (m.ID || '').toUpperCase().replace(/^AVD-/, '').replace(/-/g, '');
        const info = MISCONFIG_MAP[code];
        if (info) {
          markdown += `- **[${code}] ${info.title}**\n`;
          markdown += `  - Why: ${info.why}\n`;
          markdown += `  - Fix:\n\`\`\`yaml\n${info.fix}\n\`\`\`\n`;
          markdown += `  - Reference: [${info.ref}](${info.ref})\n\n`;
        } else {
          markdown += `- **[${code}] ${m.Title || 'Unknown Misconfiguration'}**\n`;
          if (m.PrimaryURL) markdown += `  - More info: [${m.PrimaryURL}](${m.PrimaryURL})\n`;
          if (m.References?.length) markdown += `  - References: ${m.References.join(', ')}\n`;
          markdown += `\n`;
        }
      });
    });

    if (misconfigsTotal === 0) {
      markdown += `✅ No misconfigurations found.\n`;
    }

    fs.writeFileSync(mdFile, markdown, 'utf8');
    console.log(`📄 Misconfig report generated → ${mdFile}`);
  } catch (err) {
    console.error(`❌ Failed to create misconfig report ${mdFile}: ${err.message}`);
  }
}

async function scanAndWrite(scanType, target, baseName, skipDbUpdate = true) {
  const ok = runTrivy(scanType, target, jsonFile, skipDbUpdate);
  if (ok) {
    processReport(jsonFile, mdFile);
    console.log(`📝 Saved: ${jsonFile}`);
    console.log(`📝 Saved: ${mdFile}`);

    processMisconfigOnly(jsonFile, misconfigMdFile);
  } else {
    console.log(`⚠️ Skipped writing files for ${baseName}`);
  }
}

(async () => {
  try {
    await ensureTrivy();

    if (fs.existsSync(dbPath)) {
      console.log('✅ Trivy DB already present.');
    } else {
      await downloadDbViaTrivy();
    }

    const fsData = await runTrivyJson('fs', projectDir, true);
    const fsSummary = processReportData(fsData, 'fs');

    const cfgData = await runTrivyJson('config', projectDir, true);
    const cfgSummary = processReportData(cfgData, 'config');

    const totalIssues = fsSummary.total + cfgSummary.total;
    if (totalIssues > 0) {
      console.log(`\n❌ Found ${totalIssues} issues across scans. Failing.`);
      process.exit(1);
    } else {
      console.log('\n✅ Trivy scan completed');
    }
  } catch (err) {
    console.error(`❌ Trivy scan failed: ${err.message}`);
    process.exit(1);
  }
})();
