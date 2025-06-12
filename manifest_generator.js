const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Manifest Generator for Cocos Creator Hot Update
 * Usage: node manifest_generator.js [build_path] [version] [server_url]
 */

class ManifestGenerator {
    constructor(buildPath, version, serverUrl) {
        this.buildPath = buildPath;
        this.version = version;
        this.serverUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        this.manifest = {
            packageUrl: this.serverUrl + '/remote-assets/',
            remoteManifestUrl: this.serverUrl + '/remote-assets/project.manifest',
            remoteVersionUrl: this.serverUrl + '/remote-assets/version.manifest',
            version: this.version,
            engineVersion: '3.8.0', // Update this to match your Cocos Creator version
            assets: {},
            searchPaths: []
        };
    }

    generate() {
        console.log('Generating manifest files...');
        console.log('Build path:', this.buildPath);
        console.log('Version:', this.version);
        console.log('Server URL:', this.serverUrl);

        // Scan build directory for assets
        this.scanDirectory(this.buildPath, '');

        // Generate main manifest
        const manifestPath = path.join(this.buildPath, 'project.manifest');
        fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
        console.log('Generated:', manifestPath);

        // Generate version manifest (lighter version for quick version checks)
        const versionManifest = {
            packageUrl: this.manifest.packageUrl,
            remoteManifestUrl: this.manifest.remoteManifestUrl,
            remoteVersionUrl: this.manifest.remoteVersionUrl,
            version: this.manifest.version,
            engineVersion: this.manifest.engineVersion
        };
        
        const versionPath = path.join(this.buildPath, 'version.manifest');
        fs.writeFileSync(versionPath, JSON.stringify(versionManifest, null, 2));
        console.log('Generated:', versionPath);

        console.log(`Total assets: ${Object.keys(this.manifest.assets).length}`);
        console.log('Manifest generation completed!');
    }

    scanDirectory(dirPath, relativePath) {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const relativeItemPath = relativePath ? path.join(relativePath, item) : item;
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Skip certain directories
                if (this.shouldSkipDirectory(item)) {
                    continue;
                }
                this.scanDirectory(fullPath, relativeItemPath);
            } else if (stat.isFile()) {
                // Skip certain files
                if (this.shouldSkipFile(item)) {
                    continue;
                }
                this.addAsset(fullPath, relativeItemPath.replace(/\\/g, '/'));
            }
        }
    }

    shouldSkipDirectory(dirName) {
        const skipDirs = ['.', '..', '.git', 'node_modules'];
        return skipDirs.includes(dirName);
    }

    shouldSkipFile(fileName) {
        const skipFiles = [
            'project.manifest',
            'version.manifest',
            '.DS_Store',
            'Thumbs.db'
        ];
        
        const skipExtensions = ['.meta'];
        
        return skipFiles.includes(fileName) || 
               skipExtensions.some(ext => fileName.endsWith(ext));
    }

    addAsset(filePath, relativePath) {
        const stat = fs.statSync(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
        
        // Check if file is compressed (you can extend this logic)
        const isCompressed = filePath.endsWith('.zip');
        
        this.manifest.assets[relativePath] = {
            md5: md5,
            size: stat.size,
            compressed: isCompressed
        };
    }
}

// Command line usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node manifest_generator.js [build_path] [version] [server_url]');
        console.log('Example: node manifest_generator.js ./build/android/assets 1.0.1 https://your-server.com');
        process.exit(1);
    }

    const [buildPath, version, serverUrl] = args;
    
    if (!fs.existsSync(buildPath)) {
        console.error('Build path does not exist:', buildPath);
        process.exit(1);
    }

    const generator = new ManifestGenerator(buildPath, version, serverUrl);
    generator.generate();
}

module.exports = ManifestGenerator;