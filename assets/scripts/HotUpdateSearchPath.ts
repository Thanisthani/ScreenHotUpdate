import { _decorator, Component, native, Node, sys } from 'cc';
import { NATIVE } from 'cc/env';
const { ccclass, property } = _decorator;

@ccclass('HotUpdateSearchPath')
export class HotUpdateSearchPath extends Component {
    onLoad() {
        if (!NATIVE) {
            console.log('Hot update search path setup skipped - not on native platform');
            return;
        }

        this.setupHotUpdateSearchPaths();
    }

    private setupHotUpdateSearchPaths(): void {
        try {
            console.log('Setting up hot update search paths...');
            
            // Standard hot update path
            const hotUpdateRoot = ((native.fileUtils && native.fileUtils.getWritablePath) ? 
                native.fileUtils.getWritablePath() : '/') + 'hotUpdatePath/';
            
            // Check for stored search paths from previous updates
            const storedPaths = sys.localStorage.getItem('HotUpdateSearchPaths');
            let searchPaths = native.fileUtils.getSearchPaths();
            
            if (storedPaths) {
                try {
                    const paths = JSON.parse(storedPaths);
                    console.log('Found stored search paths:', paths);
                    
                    // Validate that the stored paths still exist
                    const validPaths = paths.filter((path: string) => {
                        const exists = native.fileUtils.isDirectoryExist(path);
                        console.log(`Path ${path} exists: ${exists}`);
                        return exists;
                    });
                    
                    if (validPaths.length > 0) {
                        // Use stored valid paths
                        searchPaths = [...validPaths, ...searchPaths.filter((path: string) => !validPaths.includes(path))];
                        native.fileUtils.setSearchPaths(searchPaths);
                        console.log('Applied stored search paths:', searchPaths);
                        return;
                    }
                } catch (e) {
                    console.error('Failed to parse stored search paths:', e);
                }
            }
            
            // Default setup - check if hot update directory exists and has content
            if (native.fileUtils.isDirectoryExist(hotUpdateRoot)) {
                console.log('Hot update directory exists:', hotUpdateRoot);
                
                // Check if there are actually updated files
                const hasUpdatedFiles = this.checkForUpdatedFiles(hotUpdateRoot);
                
                if (hasUpdatedFiles) {
                    console.log('Found updated files in hot update directory');
                    
                    // Remove existing hot update path if present
                    const existingIndex = searchPaths.indexOf(hotUpdateRoot);
                    if (existingIndex > -1) {
                        searchPaths.splice(existingIndex, 1);
                    }
                    
                    // Add hot update path at the beginning for highest priority
                    searchPaths.unshift(hotUpdateRoot);
                    native.fileUtils.setSearchPaths(searchPaths);
                    
                    console.log('Hot update search paths applied:', searchPaths);
                    
                    // Store the updated paths
                    sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
                } else {
                    console.log('No updated files found in hot update directory');
                }
            } else {
                console.log('Hot update directory does not exist:', hotUpdateRoot);
            }
            
        } catch (error) {
            console.error('Failed to setup hot update search paths:', error);
        }
    }

    private checkForUpdatedFiles(hotUpdatePath: string): boolean {
        try {
            // Check for common updated file patterns
            const commonUpdatedPaths = [
                'assets/',
                'src/',
                'main.js',
                'application.js'
            ];
            
            for (const path of commonUpdatedPaths) {
                const fullPath = hotUpdatePath + path;
                if (native.fileUtils.isFileExist(fullPath) || native.fileUtils.isDirectoryExist(fullPath)) {
                    console.log('Found updated content at:', fullPath);
                    return true;
                }
            }
            
            // Also check if the directory has any files at all
            if (native.fileUtils.listFiles) {
                const files = native.fileUtils.listFiles(hotUpdatePath);
                if (files && files.length > 0) {
                    console.log('Hot update directory contains files:', files.length);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking for updated files:', error);
            return false;
        }
    }

    /**
     * Call this method to manually refresh search paths after a hot update
     */
    public refreshSearchPaths(): void {
        if (NATIVE) {
            this.setupHotUpdateSearchPaths();
        }
    }

    /**
     * Call this method to clear hot update search paths (useful for debugging)
     */
    public clearHotUpdatePaths(): void {
        if (!NATIVE) return;
        
        try {
            const searchPaths = native.fileUtils.getSearchPaths();
            const hotUpdateRoot = ((native.fileUtils && native.fileUtils.getWritablePath) ? 
                native.fileUtils.getWritablePath() : '/') + 'hotUpdatePath/';
            
            // Remove hot update paths
            const filteredPaths = searchPaths.filter((path: string) => !path.includes('hotUpdatePath'));
            native.fileUtils.setSearchPaths(filteredPaths);
            
            // Clear stored paths
            sys.localStorage.removeItem('HotUpdateSearchPaths');
            
            console.log('Hot update search paths cleared. Current paths:', filteredPaths);
        } catch (error) {
            console.error('Failed to clear hot update search paths:', error);
        }
    }
}


