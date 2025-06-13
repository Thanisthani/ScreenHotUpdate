
import { _decorator, assetManager, Component, instantiate, JsonAsset, Node, Prefab, sys, SpriteFrame, Texture2D, AudioClip, Sprite, AudioSource, native, Asset, game, director, AssetManager, Label, ProgressBar, Button } from 'cc';
import { NATIVE } from 'cc/env';
const { ccclass, property } = _decorator;


// if (jsb && jsb.fileUtils && jsb.localStorage) {
//   const hotUpdatePath = jsb.localStorage.getItem('hotUpdatePath');
//   if (hotUpdatePath && jsb.fileUtils.isDirectoryExist(hotUpdatePath)) {
//       const searchPaths = jsb.fileUtils.getSearchPaths();
//       if (!searchPaths.includes(hotUpdatePath)) {
//           searchPaths.unshift(hotUpdatePath);
//           jsb.fileUtils.setSearchPaths(searchPaths);
//       }
//       console.log("Hot update search paths applied:", searchPaths);
//   }
// }



@ccclass('RemoteEntryLoader')
export class RemoteEntryLoader extends Component {
    
    @property(Asset)
    manifestUrl: Asset = null!;

    @property(Label)
    statusLabel: Label = null!;

    @property(ProgressBar)
    progressBar: ProgressBar = null!;

    @property(Button)
    checkUpdateBtn: Button = null!;

    @property(Button)
    retryBtn: Button = null!;

    private assetsManager: any = null;
    private storagePath: string = '';
    private updating: boolean = false;
    private canRetry: boolean = false;
    private updateListener: any = null;

    onLoad() {
        if (!NATIVE) {
            this.statusLabel.string = 'Hot update is only available on native platforms';
            return;
        }

        this.storagePath = (native.fileUtils && native.fileUtils.getWritablePath) ? 
            native.fileUtils.getWritablePath() + 'hotUpdatePath/' : '/hotUpdatePath/';
        
        this.initHotUpdate();
        this.setupUI();
        this.checkForPendingUpdate();
    }

    private checkForPendingUpdate(): void {
        // Check if there's a pending hot update that needs to be applied
        const hotUpdateReady = sys.localStorage.getItem('hotUpdateReady');
        const hotUpdatePath = sys.localStorage.getItem('hotUpdatePath');
        
        if (hotUpdateReady === 'true' && hotUpdatePath) {
            console.log('Applying pending hot update...');
            this.applyHotUpdate(hotUpdatePath);
            // Clear the flags after applying
            sys.localStorage.removeItem('hotUpdateReady');
            sys.localStorage.removeItem('hotUpdatePath');
        }
    }

    private applyHotUpdate(hotUpdatePath: string): void {
        if (!NATIVE) return;

        try {
            console.log('Applying hot update from:', hotUpdatePath);
            
            // 1. Clear all cached assets first
            this.clearAssetCache();
            
            // 2. Update search paths to prioritize hot update directory
            this.updateSearchPaths(hotUpdatePath);
            
            // 3. Reload critical assets and scripts
            this.reloadUpdatedAssets();
            
            this.statusLabel.string = 'Hot update applied successfully!';
            
        } catch (error) {
            console.error('Failed to apply hot update:', error);
            this.statusLabel.string = 'Failed to apply hot update';
        }
    }

    private clearAssetCache(): void {
        // Clear asset manager cache
        if (assetManager && assetManager.assets) {
            console.log('Clearing asset cache...');
            assetManager.assets.clear();
        }

        // Clear bundle cache
        if (assetManager.bundles) {
            assetManager.bundles.forEach((bundle, name) => {
                console.log('Releasing bundle:', name);
                bundle.releaseAll();
            });
        }

        // Force garbage collection if available
        // if (typeof gc !== 'undefined') {
        //     gc();
        // }
    }

    private updateSearchPaths(hotUpdatePath: string): void {
        const searchPaths = native.fileUtils.getSearchPaths();
        console.log('Original search paths:', searchPaths);
        
        // Remove hot update path if it already exists
        const index = searchPaths.indexOf(hotUpdatePath);
        if (index > -1) {
            searchPaths.splice(index, 1);
        }
        
        // Add hot update path at the beginning for highest priority
        searchPaths.unshift(hotUpdatePath);
        native.fileUtils.setSearchPaths(searchPaths);
        
        console.log('Updated search paths:', searchPaths);
        
        // Store updated paths for persistence
        sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
    }

    private reloadUpdatedAssets(): void {
        console.log('Reloading updated assets...');
        
        // Method 1: Reload main bundle
        this.reloadMainBundle();
        
        // Method 2: Reload specific updated assets (if you know which ones)
        // this.reloadSpecificAssets();
        
        // Method 3: Force reload current scene after a delay
        this.scheduleOnce(() => {
            this.reloadCurrentScene();
        }, 1.0);
    }

    private reloadMainBundle(): void {
        const mainBundle = assetManager.getBundle('main');
        if (mainBundle) {
            console.log('Releasing main bundle...');
            mainBundle.releaseAll();
        }
        
        // Reload main bundle
        assetManager.loadBundle('main', (err, bundle) => {
            if (err) {
                console.error('Failed to reload main bundle:', err);
            } else {
                console.log('Main bundle reloaded successfully');
            }
        });
    }

    // private reloadSpecificAssets(): void {
    //     // Example: Reload specific assets that you know were updated
    //     const assetsToReload = [
    //         // Add your specific asset paths here
    //         'textures/character',
    //         'prefabs/ui',
    //         'scripts/gameplay'
    //     ];

    //     assetsToReload.forEach(assetPath => {
    //         assetManager.releaseAsset(assetPath);
    //         assetManager.loadAny(assetPath, (err, asset) => {
    //             if (err) {
    //                 console.error(`Failed to reload asset ${assetPath}:`, err);
    //             } else {
    //                 console.log(`Asset ${assetPath} reloaded successfully`);
    //             }
    //         });
    //     });
    // }

    private reloadCurrentScene(): void {
        const currentScene = director.getScene();
        if (currentScene) {
            console.log('Reloading current scene:', currentScene.name);
            director.loadScene(currentScene.name, (err) => {
                if (err) {
                    console.error('Failed to reload scene:', err);
                } else {
                    console.log('Scene reloaded successfully with updated assets');
                }
            });
        }
    }

    private initHotUpdate(): void {
        if (!NATIVE) return;

        try {
            // Ensure storage directory exists
            if (!native.fileUtils.isDirectoryExist(this.storagePath)) {
                native.fileUtils.createDirectory(this.storagePath);
            }

            console.log('Storage path:', this.storagePath);
            console.log('Manifest URL:', this.manifestUrl?.nativeUrl);

            // Create AssetsManager instance
            this.assetsManager = new native.AssetsManager(this.manifestUrl.nativeUrl, this.storagePath);
            
            // Configure AssetsManager
            this.assetsManager.setMaxConcurrentTask(3);
            
            // Set version comparison function
            this.assetsManager.setVersionCompareHandle((versionA: string, versionB: string) => {
                return this.compareVersion(versionA, versionB);
            });
            
            // Set file verification callback
            this.assetsManager.setVerifyCallback((path: string, asset: any) => {
                return this.verifyAsset(path, asset);
            });
            
            // Set update event listener
            this.updateListener = (event: any) => this.updateCallback(event);
            this.assetsManager.setEventCallback(this.updateListener);
            
            // Load local manifest
            this.loadLocalManifest();
            
            this.statusLabel.string = 'Hot update initialized';
            
        } catch (error) {
            console.error('Failed to initialize hot update:', error);
            this.statusLabel.string = 'Failed to initialize hot update';
        }
    }

    private loadLocalManifest(): void {
        if (!this.assetsManager || !this.manifestUrl?.nativeUrl) return;

        try {
            this.assetsManager.loadLocalManifest(this.manifestUrl.nativeUrl);
            
            // Setup search paths after manifest loads
            this.scheduleOnce(() => {
                this.setupInitialSearchPaths();
            }, 0.1);
            
        } catch (error) {
            console.error('Failed to load local manifest:', error);
        }
    }

    private setupInitialSearchPaths(): void {
        if (!NATIVE || !this.assetsManager) return;

        // Check if we have stored search paths from previous updates
        const storedPaths = sys.localStorage.getItem('HotUpdateSearchPaths');
        if (storedPaths) {
            try {
                const paths = JSON.parse(storedPaths);
                native.fileUtils.setSearchPaths(paths);
                console.log('Restored search paths from storage:', paths);
                return;
            } catch (e) {
                console.error('Failed to parse stored search paths:', e);
            }
        }

        // Default setup if no stored paths
        const searchPaths = native.fileUtils.getSearchPaths();
        if (searchPaths.indexOf(this.storagePath) === -1) {
            searchPaths.unshift(this.storagePath);
            native.fileUtils.setSearchPaths(searchPaths);
            console.log('Initial search paths setup:', searchPaths);
        }
    }

    private setupUI(): void {
        if (this.checkUpdateBtn) {
            this.checkUpdateBtn.node.on('click', this.checkForUpdate, this);
        }
        
        if (this.retryBtn) {
            this.retryBtn.node.on('click', this.retry, this);
            this.retryBtn.node.active = false;
        }
    }

    private checkForUpdate(): void {
        if (!NATIVE || !this.assetsManager || this.updating) return;

        console.log("Checking for updates...");
        this.updating = true;
        this.canRetry = false;
        this.checkUpdateBtn.node.active = false;
        this.retryBtn.node.active = false;
        this.statusLabel.string = 'Checking for updates...';
        this.progressBar.progress = 0;

        this.assetsManager.checkUpdate();
    }

    private retry(): void {
        if (!this.canRetry) return;
        
        this.canRetry = false;
        this.retryBtn.node.active = false;
        this.statusLabel.string = 'Retrying failed downloads...';
        
        this.assetsManager.downloadFailedAssets();
    }

    private updateCallback(event: any): void {
        const eventCode = event.getEventCode();
        console.log("Update event code:", eventCode);
        
        switch (eventCode) {
            case native.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.statusLabel.string = 'No local manifest file found';
                console.log("No local manifest file found");
                this.onUpdateFinished(false);
                break;
                
            case native.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
                this.statusLabel.string = 'Failed to download manifest';
                console.log("Failed to download manifest");
                this.onUpdateFinished(false);
                break;
                
            case native.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.statusLabel.string = 'Failed to parse manifest';
                console.log("Failed to parse manifest");
                this.onUpdateFinished(false);
                break;
                
            case native.EventAssetsManager.NEW_VERSION_FOUND:
                this.statusLabel.string = 'New version found, starting download...';
                console.log("New version found, starting download...");
                this.assetsManager.update();
                break;
                
            case native.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.statusLabel.string = 'Already up to date';
                console.log("Already up to date");
                this.onUpdateFinished(true);
                break;
                
            case native.EventAssetsManager.UPDATE_PROGRESSION:
                console.log("Update progression");
                this.handleUpdateProgress(event);
                break;
                
            case native.EventAssetsManager.ASSET_UPDATED:
                console.log("Asset updated:", event.getAssetId());
                break;
                
            case native.EventAssetsManager.ERROR_UPDATING:
                const assetId = event.getAssetId();
                const message = event.getMessage();
                this.statusLabel.string = `Failed to update asset: ${assetId}`;
                console.log(`Failed asset: ${assetId}, Message: ${message}`);
                this.onUpdateFinished(false);
                break;
                
            case native.EventAssetsManager.UPDATE_FINISHED:
                this.statusLabel.string = 'Update completed! Applying changes...';
                console.log("Update completed! Applying changes...");
                this.handleUpdateFinished();
                break;
                
            case native.EventAssetsManager.UPDATE_FAILED:
                this.statusLabel.string = 'Update failed: ' + event.getMessage();
                console.log("Update failed:", event.getMessage());
                this.canRetry = true;
                this.retryBtn.node.active = true;
                this.onUpdateFinished(false);
                break;
                
            case native.EventAssetsManager.ERROR_DECOMPRESS:
                this.statusLabel.string = 'Decompression failed'; 
                console.log("Decompression failed");
                this.onUpdateFinished(false);
                break;
        }
    }

    private handleUpdateFinished(): void {
        console.log('Update finished, applying hot update...');
        
        // Immediately apply the hot update
        this.applyHotUpdate(this.storagePath);
        
        // Set flags for next startup
        sys.localStorage.setItem('hotUpdateReady', 'true');
        sys.localStorage.setItem('hotUpdatePath', this.storagePath);

        this.onUpdateFinished(true, false); // Don't need restart since we applied immediately
    }

    private handleUpdateProgress(event: any): void {
        const percent = event.getPercent();
        const downloadedBytes = event.getDownloadedBytes();
        const totalBytes = event.getTotalBytes();
        const downloadedFiles = event.getDownloadedFiles();
        const totalFiles = event.getTotalFiles();
        
        this.progressBar.progress = percent / 100;
        
        this.statusLabel.string = `Downloading... ${Math.floor(percent)}%\n` +
            `Files: ${downloadedFiles}/${totalFiles}\n` +
            `Size: ${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)}`;

        console.log(`Progress: ${Math.floor(percent)}% - Files: ${downloadedFiles}/${totalFiles}`);
    }

    private onUpdateFinished(success: boolean, needRestart: boolean = false): void {
        this.updating = false;
        this.checkUpdateBtn.node.active = true;
        
        if (needRestart) {
            this.showRestartOption();
        }
    }

    private showRestartOption(): void {
        this.statusLabel.string = 'Update completed! Tap to restart.';
        this.checkUpdateBtn.getComponentInChildren(Label)!.string = 'Restart Game';
        this.checkUpdateBtn.node.off('click', this.checkForUpdate, this);
        this.checkUpdateBtn.node.on('click', this.restartGame, this);
    }

    private restartGame(): void {
        console.log("Restarting game...");
        
        // Clean up
        if (this.assetsManager) {
            this.assetsManager.setEventCallback(null);
        }
        
        // Clear cached assets before restart
        this.clearAssetCache();
        
        // Restart the game
        game.restart();
    }

    private compareVersion(versionA: string, versionB: string): number {
        const parseVersion = (version: string) => {
            return version.split('.').map(v => parseInt(v) || 0);
        };
        
        const vA = parseVersion(versionA);
        const vB = parseVersion(versionB);
        
        for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
            const a = vA[i] || 0;
            const b = vB[i] || 0;
            if (a !== b) return a - b;
        }
        return 0;
    }

    private verifyAsset(filePath: string, asset: any): boolean {
        // Implement MD5 check if needed
        return true;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    onDestroy(): void {
        if (this.assetsManager && this.updateListener) {
            this.assetsManager.setEventCallback(null);
        }
    }
}








// New one
//     @property(Asset)
//     manifestUrl: Asset = null!;

//     @property(Label)
//     statusLabel: Label = null!;

//     @property(ProgressBar)
//     progressBar: ProgressBar = null!;

//     @property(Button)
//     checkUpdateBtn: Button = null!;

//     @property(Button)
//     retryBtn: Button = null!;

//     private assetsManager: any = null;
//     private storagePath: string = '';
//     private updating: boolean = false;
//     private canRetry: boolean = false;
//     private updateListener: any = null;

//     onLoad() {
//         // Only initialize on native platforms
//         if (!NATIVE) {
//             this.statusLabel.string = 'Hot update is only available on native platforms';
//             return;
//         }

//         // Setup paths - customize these for your project
//         this.storagePath = (native.fileUtils && native.fileUtils.getWritablePath) ? 
//             native.fileUtils.getWritablePath() : '/'+ 'hotUpdatePath/';
        
//         this.initHotUpdate();
//         this.setupUI();
//         this.checkForPendingUpdate();
//     }

//     private checkForPendingUpdate(): void {
//         // Check if there's a pending hot update that needs to be applied
//         const hotUpdateReady = sys.localStorage.getItem('hotUpdateReady');
//         const hotUpdatePath = sys.localStorage.getItem('hotUpdatePath');
        
//         if (hotUpdateReady === 'true' && hotUpdatePath) {
//             console.log('Applying pending hot update...');
//             this.applyHotUpdate(hotUpdatePath);
//             // Clear the flags
//             sys.localStorage.removeItem('hotUpdateReady');
//             sys.localStorage.removeItem('hotUpdatePath');
//         }
//     }

//     private applyHotUpdate(hotUpdatePath: string): void {
//         if (!NATIVE) return;

//         try {
//             // Set up search paths to prioritize hot update directory
//             const searchPaths = native.fileUtils.getSearchPaths();
//             console.log('Current search paths:', searchPaths);
            
//             // Remove hot update path if it already exists
//             const index = searchPaths.indexOf(hotUpdatePath);
//             if (index > -1) {
//                 searchPaths.splice(index, 1);
//             }
            
//             // Add hot update path at the beginning for highest priority
//             searchPaths.unshift(hotUpdatePath);
//             native.fileUtils.setSearchPaths(searchPaths);
            
//             console.log('Updated search paths:', searchPaths);
//             this.statusLabel.string = 'Hot update applied successfully!';
            
//             // Force reload of main scene or assets
//             this.reloadMainAssets();
            
//         } catch (error) {
//             console.error('Failed to apply hot update:', error);
//             this.statusLabel.string = 'Failed to apply hot update';
//         }
//     }

//     private reloadMainAssets(): void {
//         // Clear asset cache to force reload
//         if (assetManager && assetManager.assets) {
//             assetManager.assets.clear();
//         }
        
//         // Reload the main bundle
//         this.scheduleOnce(() => {
//             if (director.getScene()) {
//                 director.loadScene(director.getScene().name, (err) => {
//                     if (err) {
//                         console.error('Failed to reload scene:', err);
//                     } else {
//                         console.log('Scene reloaded successfully');
//                     }
//                 });
//             }
//         }, 0.1);
//     }

//     private initHotUpdate(): void {
//         if (!NATIVE) return;

//         try {
//             // Ensure storage directory exists
//             if (!native.fileUtils.isDirectoryExist(this.storagePath)) {
//                 native.fileUtils.createDirectory(this.storagePath);
//             }

//             console.log('Storage path:', this.storagePath);
//             console.log('Manifest URL:', this.manifestUrl?.nativeUrl);

//             // Create AssetsManager instance
//             this.assetsManager = new native.AssetsManager(this.manifestUrl.nativeUrl, this.storagePath);
            
//             // Configure AssetsManager
//             this.assetsManager.setMaxConcurrentTask(3); // Reduce concurrent downloads for stability
            
//             // Set version comparison function
//             this.assetsManager.setVersionCompareHandle((versionA: string, versionB: string) => {
//                 return this.compareVersion(versionA, versionB);
//             });
            
//             // Set file verification callback
//             this.assetsManager.setVerifyCallback((path: string, asset: any) => {
//                 return this.verifyAsset(path, asset);
//             });
            
//             // Set update event listener
//             this.updateListener = (event: any) => this.updateCallback(event);
//             this.assetsManager.setEventCallback(this.updateListener);
            
//             // Load local manifest
//             this.loadLocalManifest();
            
//             this.statusLabel.string = 'Hot update initialized';
            
//         } catch (error) {
//             console.error('Failed to initialize hot update:', error);
//             this.statusLabel.string = 'Failed to initialize hot update';
//         }
//     }

//     private loadLocalManifest(): void {
//         if (!this.assetsManager || !this.manifestUrl?.nativeUrl) return;

//         try {
//             // Load the bundled manifest
//             this.assetsManager.loadLocalManifest(this.manifestUrl.nativeUrl);
            
//             // Wait for manifest to load, then setup search paths
//             this.scheduleOnce(() => {
//                 this.setupSearchPaths();
//             }, 0.1);
            
//         } catch (error) {
//             console.error('Failed to load local manifest:', error);
//         }
//     }

//     private setupSearchPaths(): void {
//         if (!NATIVE || !this.assetsManager) return;

//         try {
//             const localManifest = this.assetsManager.getLocalManifest();
//             if (!localManifest || !localManifest.isLoaded()) {
//                 console.log("Local manifest not loaded yet");
//                 return;
//             }

//             console.log("Setting up search paths...");
            
//             // Get current search paths
//             const searchPaths = native.fileUtils.getSearchPaths();
//             console.log('Original search paths:', searchPaths);
            
//             // Add hot update storage path with higher priority
//             const hotUpdatePath = this.storagePath;
//             const index = searchPaths.indexOf(hotUpdatePath);
//             if (index > -1) {
//                 searchPaths.splice(index, 1);
//             }
//             searchPaths.unshift(hotUpdatePath);
            
//             // Apply the updated search paths
//             native.fileUtils.setSearchPaths(searchPaths);
//             console.log('Updated search paths:', searchPaths);
            
//         } catch (error) {
//             console.error('Failed to setup search paths:', error);
//         }
//     }

//     private setupUI(): void {
//         if (this.checkUpdateBtn) {
//             this.checkUpdateBtn.node.on('click', this.checkForUpdate, this);
//         }
        
//         if (this.retryBtn) {
//             this.retryBtn.node.on('click', this.retry, this);
//             this.retryBtn.node.active = false;
//         }
//     }

//     private checkForUpdate(): void {
//         if (!NATIVE || !this.assetsManager || this.updating) return;

//         console.log("Checking for updates...");
//         this.updating = true;
//         this.canRetry = false;
//         this.checkUpdateBtn.node.active = false;
//         this.retryBtn.node.active = false;
//         this.statusLabel.string = 'Checking for updates...';
//         this.progressBar.progress = 0;

//         // Check for updates
//         this.assetsManager.checkUpdate();
//     }

//     private retry(): void {
//         if (!this.canRetry) return;
        
//         this.canRetry = false;
//         this.retryBtn.node.active = false;
//         this.statusLabel.string = 'Retrying failed downloads...';
        
//         this.assetsManager.downloadFailedAssets();
//     }

//     private updateCallback(event: any): void {
//         const eventCode = event.getEventCode();
//         console.log("Update event code:", eventCode);
        
//         switch (eventCode) {
//             case native.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
//                 this.statusLabel.string = 'No local manifest file found';
//                 console.log("No local manifest file found");
//                 this.onUpdateFinished(false);
//                 break;
                
//             case native.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
//                 this.statusLabel.string = 'Failed to download manifest';
//                 console.log("Failed to download manifest");
//                 this.onUpdateFinished(false);
//                 break;
                
//             case native.EventAssetsManager.ERROR_PARSE_MANIFEST:
//                 this.statusLabel.string = 'Failed to parse manifest';
//                 console.log("Failed to parse manifest");
//                 this.onUpdateFinished(false);
//                 break;
                
//             case native.EventAssetsManager.NEW_VERSION_FOUND:
//                 this.statusLabel.string = 'New version found, starting download...';
//                 console.log("New version found, starting download...");
//                 this.assetsManager.update();
//                 break;
                
//             case native.EventAssetsManager.ALREADY_UP_TO_DATE:
//                 this.statusLabel.string = 'Already up to date';
//                 console.log("Already up to date");
//                 this.onUpdateFinished(true);
//                 break;
                
//             case native.EventAssetsManager.UPDATE_PROGRESSION:
//                 console.log("Update progression");
//                 this.handleUpdateProgress(event);
//                 break;
                
//             case native.EventAssetsManager.ASSET_UPDATED:
//                 // Individual asset updated
//                 console.log("Asset updated:", event.getAssetId());
//                 break;
                
//             case native.EventAssetsManager.ERROR_UPDATING:
//               const assetId = event.getAssetId();
//               const message = event.getMessage();
//               this.statusLabel.string = `Failed to update asset: ${assetId}\n${message}`;
//               console.log(`Failed asset: ${assetId}, Message: ${message}`);
//               this.onUpdateFinished(false);
//               break;
//             case native.EventAssetsManager.UPDATE_FINISHED:
//                 this.statusLabel.string = 'Update completed! Preparing restart...';
//                 console.log("Update completed! Preparing restart...");
//                 this.handleUpdateFinished();
//                 break;
                
//             case native.EventAssetsManager.UPDATE_FAILED:
//                 this.statusLabel.string = 'Update failed: ' + event.getMessage();
//                 console.log("Update failed:", event.getMessage());
//                 this.canRetry = true;
//                 this.retryBtn.node.active = true;
//                 this.onUpdateFinished(false);
//                 break;
                
//             case native.EventAssetsManager.ERROR_DECOMPRESS:
//                 this.statusLabel.string = 'Decompression failed'; 
//                 console.log("Decompression failed");
//                 this.onUpdateFinished(false);
//                 break;
//         }
//     }

//     private handleUpdateFinished(): void {
//         console.log('Update finished, setting up for restart...');
        
//         // Update search paths immediately
//         const searchPaths = native.fileUtils.getSearchPaths();
//         const hotUpdatePath = this.storagePath;
        
//         // Remove if exists, then add at beginning
//         const index = searchPaths.indexOf(hotUpdatePath);
//         if (index > -1) searchPaths.splice(index, 1);
//         searchPaths.unshift(hotUpdatePath);
        
//         native.fileUtils.setSearchPaths(searchPaths);
//         console.log("Updated search paths:", searchPaths);
        
//         // Save restart flag
//         sys.localStorage.setItem('hotUpdateReady', 'true');
//         sys.localStorage.setItem('hotUpdatePath', hotUpdatePath);

//         // Clear asset cache before restart
//         if (assetManager && assetManager.assets) {
//             assetManager.assets.clear();
//         }

//         this.onUpdateFinished(true, true);
//     }

//     private handleUpdateProgress(event: any): void {
//         const percent = event.getPercent();
//         const downloadedBytes = event.getDownloadedBytes();
//         const totalBytes = event.getTotalBytes();
//         const downloadedFiles = event.getDownloadedFiles();
//         const totalFiles = event.getTotalFiles();
        
//         // Update progress bar
//         this.progressBar.progress = percent / 100;
        
//         // Update status label
//         this.statusLabel.string = `Downloading... ${Math.floor(percent)}%\n` +
//             `Files: ${downloadedFiles}/${totalFiles}\n` +
//             `Size: ${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)}`;

//         console.log(`Progress: ${Math.floor(percent)}% - Files: ${downloadedFiles}/${totalFiles}`);
//     }

//     private onUpdateFinished(success: boolean, needRestart: boolean = false): void {
//         this.updating = false;
//         this.checkUpdateBtn.node.active = true;
        
//         if (needRestart) {
//             this.showRestartOption();
//         }
//     }

//     private showRestartOption(): void {
//         this.statusLabel.string = 'Update completed! Tap to restart.';
//         this.checkUpdateBtn.getComponentInChildren(Label)!.string = 'Restart Game';
//         this.checkUpdateBtn.node.off('click', this.checkForUpdate, this);
//         this.checkUpdateBtn.node.on('click', this.restartGame, this);
//     }

//     private restartGame(): void {
//         console.log("Restarting game...");
        
//         // Clean up
//         if (this.assetsManager) {
//             this.assetsManager.setEventCallback(null);
//         }
        
//         // Clear any cached assets
//         if (assetManager && assetManager.assets) {
//             assetManager.assets.clear();
//         }
        
//         // Restart the game
//         game.restart();
//     }

//     private compareVersion(versionA: string, versionB: string): number {
//         const parseVersion = (version: string) => {
//             return version.split('.').map(v => parseInt(v) || 0);
//         };
        
//         const vA = parseVersion(versionA);
//         const vB = parseVersion(versionB);
        
//         for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
//             const a = vA[i] || 0;
//             const b = vB[i] || 0;
//             if (a !== b) return a - b;
//         }
//         return 0;
//     }

//     private verifyAsset(filePath: string, asset: any): boolean {
//         // Basic verification - you can implement MD5 check here
//         return true;
//     }

//     private formatBytes(bytes: number): string {
//         if (bytes === 0) return '0 B';
//         const k = 1024;
//         const sizes = ['B', 'KB', 'MB', 'GB'];
//         const i = Math.floor(Math.log(bytes) / Math.log(k));
//         return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
//     }

//     onDestroy(): void {
//         if (this.assetsManager && this.updateListener) {
//             this.assetsManager.setEventCallback(null);
//         }
//     }
// }





















// Old one


// const customManifestStr = JSON.stringify({
//     "packageUrl": "https://thanisthani.github.io/CocosHotUpdate/remote-assets/",
//     "remoteVersionUrl": "https://thanisthani.github.io/CocosHotUpdate/remote-assets/version.manifest",
//     "remoteManifestUrl": "https://thanisthani.github.io/CocosHotUpdate/remote-assets/project.manifest",
//     "version": "1.0.1",
//     "assets": {
//       "application.js": {
//         "md5": "e56639acc2fadbe3cdd20ed959694c80",
//         "size": 1269
//       },
//       "assets/internal/cc.config.json": {
//         "md5": "6b232e5c1e60eacb53201ee644c96d09",
//         "size": 2021
//       },
//       "assets/internal/import/06/06585a170.json": {
//         "md5": "c06710857fd7f811dc5cf997ad4a3d1b",
//         "size": 182434
//       },
//       "assets/internal/index.js": {
//         "md5": "485ec411d67c319c19f92a77040401f2",
//         "size": 39548
//       },
//       "assets/main/cc.config.json": {
//         "md5": "193f33083ed12f6c2419f9f33ac56415",
//         "size": 725
//       },
//       "assets/main/import/0a/0abfc91e1.json": {
//         "md5": "131834333d8457749dffbb50e4ec0538",
//         "size": 2952
//       },
//       "assets/main/import/22/22a22708-11d9-4581-8564-751935cdd74c.json": {
//         "md5": "a253314ec7107d95345d7fc89b8d7bb5",
//         "size": 72
//       },
//       "assets/main/import/22/22a22708-11d9-4581-8564-751935cdd74c@6c48a.json": {
//         "md5": "2c15e07fa8b0bbd0c9d00c0c25d27380",
//         "size": 104
//       },
//       "assets/main/import/ba/ba21476f-2866-4f81-9c4d-6e359316e448.json": {
//         "md5": "8bce784945efd554512e8520ec9caccb",
//         "size": 192
//       },
//       "assets/main/import/fd/fd8ec536-a354-4a17-9c74-4f3883c378c8.json": {
//         "md5": "731f44a39ce9377ee6de8ba34edaf039",
//         "size": 480
//       },
//       "assets/main/index.js": {
//         "md5": "fb35682025abdd8ff67540a131883db0",
//         "size": 8843
//       },
//       "assets/main/native/22/22a22708-11d9-4581-8564-751935cdd74c.png": {
//         "md5": "cb181f1870ecc94fd2fc38cfff337826",
//         "size": 25534
//       },
//       "assets/main/native/f6/f68fd36f-24da-4868-82b3-35759975edff.manifest": {
//         "md5": "45dd6fa3f3dda609d6684ed235ab7ad9",
//         "size": 2964
//       },
//       "jsb-adapter/engine-adapter.js": {
//         "md5": "d7c197e587a97d0240e760508b009865",
//         "size": 168637
//       },
//       "jsb-adapter/web-adapter.js": {
//         "md5": "2ab62c17fde76578b00670430e4a09bf",
//         "size": 173353
//       },
//       "main.js": {
//         "md5": "e3167153cd7edbda3a1b2550fb24194a",
//         "size": 840
//       },
//       "src/chunks/bundle.js": {
//         "md5": "5090af38add59c9ee667e7aa7630e033",
//         "size": 976
//       },
//       "src/cocos-js/cc.js": {
//         "md5": "2b73eb923056ca6eddef8cbc89ff6f5a",
//         "size": 1879194
//       },
//       "src/effect.bin": {
//         "md5": "4f2f1c1f24379fb11eeff163fb321177",
//         "size": 5442
//       },
//       "src/import-map.json": {
//         "md5": "fc840d99cbb3732367a93c054d1200d4",
//         "size": 37
//       },
//       "src/settings.json": {
//         "md5": "c1c716b026f412733bcbd66e8ad4f64c",
//         "size": 21284
//       },
//       "src/system.bundle.js": {
//         "md5": "f45da0108c6bc0747a05f0f669023838",
//         "size": 8319
//       }
//     },
//     "searchPaths": []
// });

// @ccclass('RemoteEntryLoader')
// export class RemoteEntryLoader extends Component {


// @property(Asset)
//     manifestUrl: Asset = null!;

// @property(Label)
// statusLabel: Label = null!;

// @property(ProgressBar)
// progressBar: ProgressBar = null!;

// @property(Button)
// checkUpdateBtn: Button = null!;

// @property(Button)
// retryBtn: Button = null!;

// private assetsManager: any = null;
// private storagePath: string = '';
// // private manifestUrl: string = '';
// private updating: boolean = false;

// private canRetry: boolean = false;
// private updateListener: any = null;

// onLoad() {
//     // Only initialize on native platforms
//     if (!NATIVE) {
//         this.statusLabel.string = 'Hot update is only available on native platforms';
//         return;
//     }

//     // Setup paths - customize these for your project
//     this.storagePath = ((native.fileUtils && native.fileUtils.getWritablePath) ? 
//         native.fileUtils.getWritablePath() : '/') + 'hot-update/';
    
//     // Your remote manifest URL - replace with your server URL
//     // this.manifestUrl = 'https://thanisthani.github.io/CocosHotUpdate/remote-assets/project.manifest';
    
//     this.initHotUpdate();
//     this.setupUI();
// }

// private initHotUpdate(): void {
//     if (!NATIVE) return;

//     try {

//       if (NATIVE) {
//         const hotUpdateRoot = native.fileUtils.getWritablePath() + 'hot-update/';
//         console.log('Hot update directory exists:', native.fileUtils.isDirectoryExist(hotUpdateRoot));
//         console.log('Manifest exists:', native.fileUtils.isFileExist(hotUpdateRoot + 'project.manifest'));
        
//         // List files in hot update directory
//         const files = native.fileUtils.listFiles(hotUpdateRoot);
//         console.log('Files in hot update directory:', files);
//     }
    
//          // Ensure storage directory exists
//          if (!native.fileUtils.isDirectoryExist(this.storagePath)) {
//           native.fileUtils.createDirectory(this.storagePath);
//       }

//         // Create AssetsManager instance
//         this.assetsManager = new native.AssetsManager(this.manifestUrl.nativeUrl, this.storagePath);
        
//         // Set up search paths for hot updated assets
//         this.setupSearchPaths();
        
//         // Configure AssetsManager
//         this.assetsManager.setMaxConcurrentTask(5); // Limit concurrent downloads
        
//         // Set version comparison function (optional)
//         this.assetsManager.setVersionCompareHandle((versionA: string, versionB: string) => {
//             return this.compareVersion(versionA, versionB);
//         });
        
//         // Set file verification callback (optional but recommended)
//         this.assetsManager.setVerifyCallback((path: string, asset: any) => {
//             return this.verifyAsset(path, asset);
//         });
        
//         // Set update event listener
//         this.updateListener = (event: any) => this.updateCallback(event);
//         this.assetsManager.setEventCallback(this.updateListener);
        
//         this.statusLabel.string = 'Hot update initialized';
        
//     } catch (error) {
//         console.error('Failed to initialize hot update:', error);
//         this.statusLabel.string = 'Failed to initialize hot update';
//     }
// }

// private setupSearchPaths(): void {
//     if (!NATIVE || !this.assetsManager) return;

//     try {
//       if (this.assetsManager.getState() === native.AssetsManager.State.UNINITED) {
//                         console.log("loadLocalManifest is called")
//                         if (this.manifestUrl && this.manifestUrl.nativeUrl) {
//                             this.assetsManager.loadLocalManifest(this.manifestUrl.nativeUrl);
//                         }
//                     }
//         // Get hot update search paths from local manifest
//         const localManifest = this.assetsManager.getLocalManifest();
//         if (!localManifest || !localManifest.isLoaded()) {
//           console.log("Failed to load bundled manifest");
//           throw new Error('Failed to load bundled manifest');
          
//       }

//         if (localManifest && localManifest.isLoaded()) {
//           console.log("localManifest is loaded");
//             const hotUpdateSearchPaths = localManifest.getSearchPaths();
//             const searchPaths = native.fileUtils.getSearchPaths();
            
//             // Insert hot update paths at the beginning for priority
//             Array.prototype.unshift.apply(searchPaths, hotUpdateSearchPaths);
//             native.fileUtils.setSearchPaths(searchPaths);
            
//             console.log('Search paths updated:', searchPaths);
//         }
//     } catch (error) {
//         console.error('Failed to setup search paths:', error);
//     }
// }

// private setupUI(): void {
//     // Setup button callbacks
//     if (this.checkUpdateBtn) {
//         this.checkUpdateBtn.node.on('click', this.checkForUpdate, this);
//     }
    
//     if (this.retryBtn) {
//         this.retryBtn.node.on('click', this.retry, this);
//         this.retryBtn.node.active = false;
//     }
// }

// private checkForUpdate(): void {
//     if (!NATIVE || !this.assetsManager || this.updating) return;

//     console.log("checkForUpdate is called");
//     this.updating = true;
//     this.canRetry = false;
//     this.checkUpdateBtn.node.active = false;
//     this.retryBtn.node.active = false;
//     this.statusLabel.string = 'Checking for updates...';
//     this.progressBar.progress = 0;

//     // Check for updates
//     this.assetsManager.checkUpdate();
// }

// private retry(): void {
//     if (!this.canRetry) return;
    
//     this.canRetry = false;
//     this.retryBtn.node.active = false;
//     this.statusLabel.string = 'Retrying failed downloads...';
    
//     // Retry downloading failed assets
//     this.assetsManager.downloadFailedAssets();
// }

// private updateCallback(event: any): void {
//     const eventCode = event.getEventCode();
//     console.log("update eventCode is", eventCode);
    
//     switch (eventCode) {
//         case native.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
//             this.statusLabel.string = 'No local manifest file found';
//             this.onUpdateFinished(false);
//             break;
            
//         case native.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
//             this.statusLabel.string = 'Failed to download manifest';
//             this.onUpdateFinished(false);
//             break;
            
//         case native.EventAssetsManager.ERROR_PARSE_MANIFEST:
//             this.statusLabel.string = 'Failed to parse manifest';
//             this.onUpdateFinished(false);
//             break;
            
//         case native.EventAssetsManager.NEW_VERSION_FOUND:
//             this.statusLabel.string = 'New version found, starting download...';
//             this.assetsManager.update();
//             break;
            
//         case native.EventAssetsManager.ALREADY_UP_TO_DATE:
//             this.statusLabel.string = 'Already up to date';
//             this.onUpdateFinished(true);
//             break;
            
//         case native.EventAssetsManager.UPDATE_PROGRESSION:
//             this.handleUpdateProgress(event);
//             break;
            
//         case native.EventAssetsManager.ASSET_UPDATED:
//             // Individual asset updated
//             break;
            
//         case native.EventAssetsManager.ERROR_UPDATING:
//             this.statusLabel.string = 'Update error: ' + event.getMessage();
//             this.onUpdateFinished(false);
//             break;
            
//         case native.EventAssetsManager.UPDATE_FINISHED:
//             this.statusLabel.string = 'Update completed! Restart required.';
//             const searchPaths = native.fileUtils.getSearchPaths();
//             console.log("searchPaths is", searchPaths);
//             const hotUpdatePath = this.storagePath;
            
//             // Remove if exists, then add at beginning
//             const index = searchPaths.indexOf(hotUpdatePath);
//             if (index > -1) searchPaths.splice(index, 1);
//             searchPaths.unshift(hotUpdatePath);
            
//             native.fileUtils.setSearchPaths(searchPaths);
//             console.log("updated searchPaths is", searchPaths);
            
//             // Save restart flag
//             sys.localStorage.setItem('hotUpdateReady', 'true');
//             sys.localStorage.setItem('hotUpdatePath', hotUpdatePath);

//             this.onUpdateFinished(true, true);
//             break;
            
//         case native.EventAssetsManager.UPDATE_FAILED:
//             this.statusLabel.string = 'Update failed: ' + event.getMessage();
//             this.canRetry = true;
//             this.retryBtn.node.active = true;
//             this.onUpdateFinished(false);
//             break;
            
//         case native.EventAssetsManager.ERROR_DECOMPRESS:
//             this.statusLabel.string = 'Decompression failed';
//             this.onUpdateFinished(false);
//             break;
//     }
// }

// private handleUpdateProgress(event: any): void {
//     const percent = event.getPercent();
//     const filePercent = event.getPercentByFile();
//     const downloadedBytes = event.getDownloadedBytes();
//     const totalBytes = event.getTotalBytes();
//     const downloadedFiles = event.getDownloadedFiles();
//     const totalFiles = event.getTotalFiles();
    
//     // Update progress bar (using byte progress)
//     this.progressBar.progress = percent / 100;
    
//     // Update status label with detailed progress
//     this.statusLabel.string = `Downloading... ${Math.floor(percent)}%\n` +
//         `Files: ${downloadedFiles}/${totalFiles}\n` +
//         `Size: ${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)}`;

//         console.log(`Downloading... ${Math.floor(percent)}%\n` +
//         `Files: ${downloadedFiles}/${totalFiles}\n` +
//         `Size: ${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)}`)
// }

// private onUpdateFinished(success: boolean, needRestart: boolean = false): void {
//     this.updating = false;
//     this.checkUpdateBtn.node.active = true;
    
//     if (needRestart) {
//         // Show restart button or automatically restart
//         this.showRestartOption();
//     }
// }

// private showRestartOption(): void {
//     // You can show a restart dialog here
//     // For now, we'll just add a restart button functionality
//     this.statusLabel.string = 'Update completed! Tap to restart.';
//     this.checkUpdateBtn.getComponentInChildren(Label)!.string = 'Restart Game';
//     this.checkUpdateBtn.node.off('click', this.checkForUpdate, this);
//     this.checkUpdateBtn.node.on('click', this.restartGame, this);
// }

// private restartGame(): void {
//   console.log("restartGame is called");
//     // Clean up before restart
//     if (this.assetsManager) {
//         this.assetsManager.setEventCallback(null);
//     }
    
//     // Restart the game
//     game.restart();
// }

// private compareVersion(versionA: string, versionB: string): number {
//     // Custom version comparison logic
//     // Return > 0 if versionA > versionB
//     // Return 0 if versionA == versionB
//     // Return < 0 if versionA < versionB
    
//     const parseVersion = (version: string) => {
//         return version.split('.').map(v => parseInt(v) || 0);
//     };
    
//     const vA = parseVersion(versionA);
//     const vB = parseVersion(versionB);
    
//     for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
//         const a = vA[i] || 0;
//         const b = vB[i] || 0;
//         if (a !== b) return a - b;
//     }
//     return 0;
// }

// private verifyAsset(filePath: string, asset: any): boolean {
//     // Asset verification logic
//     // You can implement MD5 check here if needed
//     // For now, just return true to skip verification
//     return true;
// }

// private formatBytes(bytes: number): string {
//     if (bytes === 0) return '0 B';
//     const k = 1024;
//     const sizes = ['B', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
// }

// onDestroy(): void {
//     // Clean up
//     if (this.assetsManager && this.updateListener) {
//         this.assetsManager.setEventCallback(null);
//     }
// }

// }


//     @property(Asset)
//     manifestUrl: Asset = null!;

//     private _updating = false;
//     private _canRetry = false;
//     private _storagePath = '';
//     private _am: any = null; // AssetsManager type
//     private _checkListener: any = null;
//     private _updateListener: any = null;
//     private _failCount = 0;
//     private versionCompareHandle: (versionA: string, versionB: string) => number = null!;

//     checkCb(event: any) {
//         console.log('Check Code: ' + event.getEventCode());
//         switch (event.getEventCode()) {
//             case native.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
//                 console.log("No local manifest file found, hot update skipped.");
//                 break;
//             case native.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
//                 console.log("Fail to download manifest file.");
//             case native.EventAssetsManager.ERROR_PARSE_MANIFEST:
//                 console.log("Fail to download manifest file, hot update skipped.");
//                 break;
//             case native.EventAssetsManager.ALREADY_UP_TO_DATE:
//                 console.log("Already up to date with the latest remote version.");
//                 break;
//             case native.EventAssetsManager.NEW_VERSION_FOUND:
//                 this._updating=false
//                 console.log('New version found, please try to update. (' + Math.ceil(this._am.getTotalBytes() / 1024) + 'kb)');
//                 // Start hot update immediately
//                 this.hotUpdate();
//                 break;
//             default:
//                 console.log("Check code description is not found")
//                 return;
//         }

//         console.log("checkCb is called")
//         // Clean up check callback
//         this._am.setEventCallback(null);
//         this._checkListener = null;
//         this._updating = false;
//     }
//     updateCb(event: any) {
//         let needRestart = false;
//         let failed = false;
        
//         console.log("updateCb is called",event.getEventCode())
//         switch (event.getEventCode()) {
//             case native.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
//                 console.log('No local manifest file found, hot update skipped.');   
//                 failed = true;
//                 break;
//             // case native.EventAssetsManager.UPDATE_PROGRESSION:
//             //     const progress = (event.getDownloadedFiles() / event.getTotalFiles() * 100).toFixed(2);
//             //     console.log('Download progress: ' + progress + '% (' + event.getDownloadedFiles() + ' / ' + event.getTotalFiles() + ')');
//             //     console.log('Bytes: ' + event.getDownloadedBytes() + ' / ' + event.getTotalBytes());
                
//             //     const msg = event.getMessage();
//             //     if (msg) {
//             //         console.log('Updated file: ' + msg);
//             //     }
//             //     // Don't return here, let the function continue
//             //     break;
//             case native.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
//             case native.EventAssetsManager.ERROR_PARSE_MANIFEST:
//                 console.log('Fail to download manifest file, hot update skipped.');
//                 failed = true;
//                 break;
//             case native.EventAssetsManager.ALREADY_UP_TO_DATE:
//                 console.log('Already up to date with the latest remote version.');  
//                 failed = true;
//                 break;
//             case native.EventAssetsManager.UPDATE_FINISHED:
//                 console.log('Update finished successfully! ' + event.getMessage());  
//                 needRestart = true;
//                 break;
//             case native.EventAssetsManager.UPDATE_FAILED:
//                 console.log('Update failed. ' + event.getMessage());  
//                 this._updating = false;
//                 this._canRetry = true;
//                 break;
//             case native.EventAssetsManager.ERROR_UPDATING:
//                 console.log('Asset update error: ' + event.getAssetId() + ', ' + event.getMessage());
//                 break;
//             case native.EventAssetsManager.ERROR_DECOMPRESS:
//                 console.log('Decompress error: ' + event.getMessage());
//                 break;
//             default:
//                 console.log("Update code description is not found")
//             return
//         }
    
//         console.log("Update check completed");
        
//         // Handle failure cases
//         if (failed) {
//             console.log("Update failed, cleaning up...");
//             this.cleanupUpdateCallbacks();
//             // Load scene even if update failed
//         }
    
//         // Handle successful completion
//         if (needRestart) {
//             console.log("Update completed successfully, preparing restart...");
//             this.cleanupUpdateCallbacks();
            
//             // Add a small delay to ensure all operations are completed
//             this.scheduleOnce(() => {
//                 this.restartGame();
//             }, 0.5);
//         }

//         this._am.setEventCallback(null);
//         this._checkListener = null;
//         this._updating = false;
//     }

// // Helper method to clean up callbacks
// private cleanupUpdateCallbacks() {
//     if (this._am) {
//         this._am.setEventCallback(null);
//     }
//     this._updateListener = null;
//     this._updating = false;
// }

// // Improved restart method with better error handling
// restartGame() {
//     try {
//         console.log('Preparing to restart with updated assets...');
        
//         // Get search paths and update them
//         const searchPaths = native.fileUtils.getSearchPaths();
//         const localManifest = this._am.getLocalManifest();
        
//         if (localManifest && localManifest.isLoaded()) {
//             const newPaths = localManifest.getSearchPaths();
//             console.log('New search paths: ', JSON.stringify(newPaths));
            
//             if (newPaths && newPaths.length > 0) {
//                 // Clear asset manager cache
//                 assetManager.releaseAll();
                
//                 // Prepend new paths to existing search paths
//                 const updatedPaths = [...newPaths, ...searchPaths];
                
//                 // Store search paths for persistence
//                 if (sys.localStorage) {
//                     sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(updatedPaths));
//                 }
                
//                 // Set new search paths
//                 native.fileUtils.setSearchPaths(updatedPaths);
//                 console.log('Updated search paths: ', JSON.stringify(updatedPaths));
//             }
//         }

//         // Force restart the game with better timing
//         console.log('Executing game restart in 1 second...');
//         this.scheduleOnce(() => {
//             console.log('Restarting game now...');
            
//             // Try multiple restart methods for better compatibility
//             if (game.restart) {
//                 console.log("game.restart is called")
//                 game.restart();
//             } else if (director.loadScene) {
//                 // Fallback: reload the current scene
//                 console.log("director.loadScene is called")
//                 director.loadScene(director.getScene().name);
//             } else {
//                 // Last resort: reload the page (web only)
//                 if (typeof window !== 'undefined' && window.location) {
//                     window.location.reload();
//                     console.log("window.location.reload is called")
//                 }
//             }
//         }, 1.0);
        
//     } catch (error) {
//         console.error('Error during restart:', error);
//         // Fallback restart attempt
//         this.scheduleOnce(() => {
//             console.log('Attempting fallback restart...');
//             game.restart();
//         }, 2.0);
//     }
// }

//     loadCustomManifest() {
//         if (this._am.getState() === native.AssetsManager.State.UNINITED) {
//             const manifest = new native.Manifest(customManifestStr, this._storagePath);
//             this._am.loadLocalManifest(manifest, this._storagePath);
//             console.log('Custom manifest loaded successfully');
//         }
//     }

//     retry() {
//         if (!this._updating && this._canRetry) {
//             this._canRetry = false;
//             console.log('Retrying failed assets...');
//             this._am.downloadFailedAssets();
//             this._updating = true;
//         }
//     }

//     checkUpdate() {
//         if (this._updating) {
//             console.log('Already checking or updating...');
//             return;
//         }
        
//         console.log('Starting update check...');
        
//         if (this._am.getState() === native.AssetsManager.State.UNINITED) {
//             // Load local manifest first
//             if (this.manifestUrl && this.manifestUrl.nativeUrl) {
//                 this._am.loadLocalManifest(this.manifestUrl.nativeUrl);
//             } else {
//                 // Use custom manifest if no manifest URL provided
//                 this.loadCustomManifest();
//             }
//         }
        
//         if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
//             console.log('Failed to load local manifest, trying custom manifest...');
//             this.loadCustomManifest();
//             if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
//                 console.log('Failed to load any manifest, skipping hot update');
//                 return;
//             }
//         }
        
//         this._checkListener = this.checkCb.bind(this);
//         this._am.setEventCallback(this._checkListener);
//         this._am.checkUpdate();
//         this._updating = true;
//     }

//     hotUpdate() {
//         if (this._am && !this._updating) {
//             console.log('Starting hot update...');
            
//             // Clean up any existing callbacks first
//             this.cleanupUpdateCallbacks();
//             this._updateListener = this.updateCb.bind(this);
//             this._am.setEventCallback(this._updateListener);
    
//             if (this._am.getState() === native.AssetsManager.State.UNINITED) {
//                 console.log("loadLocalManifest is called")
//                 if (this.manifestUrl && this.manifestUrl.nativeUrl) {
//                     this._am.loadLocalManifest(this.manifestUrl.nativeUrl);
//                 } else {
//                     this.loadCustomManifest();
//                 }
//             }
    
//             this._failCount = 0;
//             this._am.update();
//             this._updating = true;
            
//             console.log('Hot update started, state:', this._am.getState());

//             this.scheduleOnce(() => {
//                 this.restartGame();
//             }, 100);
//         } else {
//             console.log('Cannot start hot update - already updating or AM not available');
//         }
//     }

//     onLoad() {
//         // Hot update is only available in Native build
//         if (!sys.isNative) {
//             console.warn('Hot update is only available in native builds, loading scene directly');
//             return;
//         }

//         console.log('Initializing hot update system...');

//         // Use the writable path for storing remote assets
//         this._storagePath = (native.fileUtils ? native.fileUtils.getWritablePath() : '/') + 'blackjack-remote-asset';
//         console.log('Storage path for remote asset: ' + this._storagePath);

//         // Check if we have stored search paths from previous update
//         if (sys.localStorage) {
//             const storedPaths = sys.localStorage.getItem('HotUpdateSearchPaths');
//             if (storedPaths) {
//                 try {
//                     const paths = JSON.parse(storedPaths);
//                     native.fileUtils.setSearchPaths(paths);
//                     console.log('Restored search paths from storage: ', JSON.stringify(paths));
//                 } catch (e) {
//                     console.error('Failed to parse stored search paths:', e);
//                 }
//             }
//         }

//         // Setup version comparison handler
//         this.versionCompareHandle = (versionA: string, versionB: string): number => {
//             console.log("Version comparison: A=" + versionA + ', B=' + versionB);
            
//             const vA = versionA.split('.');
//             const vB = versionB.split('.');
            
//             for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
//                 const a = parseInt(vA[i] || '0');
//                 const b = parseInt(vB[i] || '0');
                
//                 if (a !== b) {
//                     return a - b;
//                 }
//             }
            
//             return 0;
//         };

//         // Initialize AssetsManager
//         this._am = new native.AssetsManager('', this._storagePath, this.versionCompareHandle);

//         // Setup verification callback
//         this._am.setVerifyCallback((path: string, asset: any): boolean => {
//             const compressed = asset.compressed;
//             const expectedMD5 = asset.md5;
//             const relativePath = asset.path;
            
//             if (compressed) {
//                 console.log("Verification passed (compressed): " + relativePath);
//                 return true;
//             } else {
//                 console.log("Verification passed: " + relativePath + ' (' + expectedMD5 + ')');
//                 return true;
//             }
//         });

//         // Start the update check process
//         this.checkUpdate();
//     }

//     onDestroy() {
//         if (this._am) {
//             this._am.setEventCallback(null);
//         }
//         this._updateListener = null;
//         this._checkListener = null;
//     }
