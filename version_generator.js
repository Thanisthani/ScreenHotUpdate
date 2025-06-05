const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-')) {
        const key = args[i].substring(1);
        const value = args[i + 1];
        options[key] = value;
        i++;
    }
}

// Required parameters
const version = options.v;
const url = options.u;
const sourceDir = options.s;
const destDir = options.d;

if (!version || !url || !sourceDir || !destDir) {
    console.error('Usage: node version_generator.js -v <version> -u <url> -s <source_dir> -d <dest_dir>');
    process.exit(1);
}

// Ensure the URL ends with a slash
const baseUrl = url.endsWith('/') ? url : url + '/';

// Function to calculate MD5 hash of a file
function calculateMD5(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Function to get file size
function getFileSize(filePath) {
    return fs.statSync(filePath).size;
}

// Function to recursively get all files in a directory
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Generate project.manifest
function generateProjectManifest() {
    const files = getAllFiles(sourceDir);
    const assets = {};
    const searchPaths = [];
    
    files.forEach(file => {
        const relativePath = path.relative(sourceDir, file).replace(/\\/g, '/');
        const md5 = calculateMD5(file);
        const size = getFileSize(file);
        
        assets[relativePath] = {
            md5: md5,
            size: size
        };
    });
    
    const manifest = {
        packageUrl: baseUrl,
        remoteVersionUrl: baseUrl + 'version.manifest',
        remoteManifestUrl: baseUrl + 'project.manifest',
        version: version,
        assets: assets,
        searchPaths: searchPaths
    };
    
    fs.writeFileSync(
        path.join(destDir, 'project.manifest'),
        JSON.stringify(manifest, null, 2)
    );
}

// Generate version.manifest
function generateVersionManifest() {
    const manifest = {
        packageUrl: baseUrl,
        remoteVersionUrl: baseUrl + 'version.manifest',
        remoteManifestUrl: baseUrl + 'project.manifest',
        version: version,
        engineVersion: '3.0.0'  // Update this to match your Cocos Creator version
    };
    
    fs.writeFileSync(
        path.join(destDir, 'version.manifest'),
        JSON.stringify(manifest, null, 2)
    );
}

// Generate both manifests
generateProjectManifest();
generateVersionManifest();

console.log('Manifest files generated successfully!');
console.log('Version:', version);
console.log('URL:', baseUrl);
console.log('Source directory:', sourceDir);
console.log('Destination directory:', destDir);
