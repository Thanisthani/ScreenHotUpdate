// 
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
            // Skip manifest files to avoid conflicts
            if (!file.endsWith('.manifest')) {
                fileList.push(filePath);
            }
        }
    });
    
    return fileList;
}

// Generate project.manifest
function generateProjectManifest() {
    const files = getAllFiles(sourceDir);
    const assets = {};
    
    files.forEach(file => {
        const relativePath = path.relative(sourceDir, file).replace(/\\/g, '/');
        const md5 = calculateMD5(file);
        const size = getFileSize(file);
        
        assets[relativePath] = {
            md5: md5,
            size: size,
            compressed: false, // Set to true if you're using compression
            // path: relativePath
        };
    });
    
    // Important: Include search paths for proper asset loading
    const searchPaths = [
        '', // Current directory (hot update directory)
        'assets/', // Assets directory
        'src/', // Source directory
        'jsb-adapter/' // JSB adapter directory
    ];
    
    const manifest = {
        packageUrl: baseUrl,
        remoteVersionUrl: baseUrl + 'version.manifest',
        remoteManifestUrl: baseUrl + 'project.manifest',
        version: version,
        assets: assets,
        searchPaths: []
    };
    
    // Write manifest with proper formatting
    const manifestContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(destDir, 'project.manifest'), manifestContent);
    
    console.log(`Generated project.manifest with ${Object.keys(assets).length} assets`);
    console.log('Assets included:');
    Object.keys(assets).forEach(assetPath => {
        console.log(`  - ${assetPath} (${formatBytes(assets[assetPath].size)})`);
    });
}

// Generate version.manifest
function generateVersionManifest() {
    const manifest = {
        packageUrl: baseUrl,
        remoteVersionUrl: baseUrl + 'version.manifest',
        remoteManifestUrl: baseUrl + 'project.manifest',
        version: version,
        engineVersion: '3.8.0' // Update to match your Cocos Creator version
    };
    
    const manifestContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(destDir, 'version.manifest'), manifestContent);
    
    console.log('Generated version.manifest');
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate source directory structure
function validateSourceStructure() {
    const requiredPaths = [
        path.join(sourceDir, 'main.js'),
        path.join(sourceDir, 'assets'),
        path.join(sourceDir, 'src')
    ];
    
    const missingPaths = requiredPaths.filter(p => !fs.existsSync(p));
    
    if (missingPaths.length > 0) {
        console.warn('Warning: Some expected files/directories are missing:');
        missingPaths.forEach(p => console.warn(`  - ${path.relative(sourceDir, p)}`));
    }
}

// Create destination directory if it doesn't exist
function ensureDestinationDir() {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`Created destination directory: ${destDir}`);
    }
}

// Main execution
try {
    console.log('=== Hot Update Manifest Generator ===');
    console.log('Version:', version);
    console.log('Base URL:', baseUrl);
    console.log('Source directory:', sourceDir);
    console.log('Destination directory:', destDir);
    console.log('');
    
    validateSourceStructure();
    ensureDestinationDir();
    
    // Generate both manifests
    generateProjectManifest();
    generateVersionManifest();
    
    console.log('');
    console.log('✅ Manifest files generated successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Upload all files to your server');
    console.log('2. Ensure the manifest URL in your app points to the correct location');
    console.log('3. Test the hot update functionality');
    
} catch (error) {
    console.error('❌ Error generating manifest files:', error.message);
    process.exit(1);
}