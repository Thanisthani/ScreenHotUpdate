import { _decorator, assetManager, Component, instantiate, JsonAsset, Node, Prefab } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RemoteEntryLoader')
export class RemoteEntryLoader extends Component {
    @property(Node)
    gameContent: Node = null;

    onLoad() {

        // After hot update, always load the entry config from the remote bundle
        assetManager.loadBundle('config', (err, bundle) => {
            if (err) {
                // Optionally, try loading from remote URL if not found locally
                assetManager.loadBundle('https://thanisthani.github.io/CocosHotUpdate/config', (err2, bundle2) => {
                    if (err2) {
                        console.error('Failed to load config bundle:', err2);
                        return;
                    }
                    this.loadEntry(bundle2);
                });
                return;
            }
            this.loadEntry(bundle);
        });
    }

    private loadEntry(bundle) {
        bundle.load('entry', JsonAsset, (err, jsonAsset) => {
            if (err) {
                console.error('Failed to load entry config:', err);
                return;
            }
            const entry = jsonAsset.json; // e.g., { "mainPrefab": "ImageScreen" }
            bundle.load(entry.mainPrefab, Prefab, (err, prefab) => {
                if (err) {
                    console.error('Failed to load main prefab:', err);
                    return;
                }
                // Remove the old GameContent label if it exists
                if (this.gameContent && this.gameContent.isValid) {
                    this.gameContent.destroy();
                }
                const node = instantiate(prefab);
                node.parent = this.node;
            });
        });
    }
}


