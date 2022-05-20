import { Asset } from "cc";

export class ResHolder {
    private _assetMap: Map<string, Asset> = new Map();

    get assetMap(): ReadonlyMap<string, Asset> { return this._assetMap; }

    add(asset: Asset, url: string) {
        if (this._assetMap.has(url))
            return;
        this._assetMap.set(url, asset);
        asset.addRef();
    }

    tryRelease(asset: Asset, url: string) {
        if (asset.refCount <= 1) {
            asset.decRef();
            this._assetMap.delete(url);
        }
    }

    reset() {
        this._assetMap.clear();
    }

    free() {
        this._assetMap.forEach((a, k) => this.tryRelease(a, k));
    }
}