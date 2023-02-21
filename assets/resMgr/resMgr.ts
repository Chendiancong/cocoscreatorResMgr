import { Asset, assetManager, AssetManager, resources, SceneAsset } from "cc";
import { asDelegate, IDelegate } from "../core/utils/Delegate";
import { ResHolder } from "./resHolder";

interface IResRequestBase { }

type LoadCompleteCallback<T extends Asset> = (
    error: any,
    asset?: T | T[]
) => void;

type PreloadCompleteCallback = (
    error: any,
    item: AssetManager.RequestItem[],
) => void;

type AssetOption = {
    reloadAsset: boolean;
    cacheAsset: boolean;
}

function promisefy(fn: Function) {
    return function(...args) {
        return new Promise<any>((resolve, reject) => {
            function customCallback(err, ...results) {
                if (err) {
                    return reject(err);
                }
                return resolve(results.length == 1 ? results[0] : results);
            }
            args.push(customCallback);
            fn.apply(this, args);
        });
    }
}

let aloadBundle = promisefy(assetManager.loadBundle.bind(assetManager));
let resHolder = new ResHolder();

export class ResMgr {
    resHolder: ResHolder = resHolder;
    bundles: { [name: string]: AssetManager.Bundle } = {};
    defaultBundle: AssetManager.Bundle = resources;

    async aloadBundle(bundleName: string) {
        let bundle = await aloadBundle(bundleName);
        if (bundle != void 0)
            this.bundles[bundleName] = bundle;
        return bundle;
    }

    setDefaultBundle(bundle: AssetManager.Bundle) {
        this.defaultBundle = bundle;
    }

    getBundle(bundleName?: string) {
        return !!bundleName ? this.bundles[bundleName] : this.defaultBundle;
    }

    async aloadRes<T extends Asset>(url: string|string[], assetType: { new(...args): T }, bundleName?: string) {
        let req = this.createResRequest(assetType);
        this.setupLoadResRequest(req, url, this.getBundle(bundleName));
        let asset = await <Promise<T[]>>req.start();
        resReqPool.push(req);
        return asset;
    }

    async apreloadRes<T extends Asset>(url: string|string[], assetType: { new(...args): T }, bundleName?: string) {
        let req = this.createResRequest(assetType)
        this.setupLoadResRequest(req, url, this.getBundle(bundleName));
        req.setLoadAction(ResRequestLoadAction.Preload);
        await req.start();
        resReqPool.push(req);
    }

    async aloadResDir(url: string, bundleName?: string) {
        let req = this.createResRequest(Asset);
        this.setupLoadDirRequest(req, url, this.getBundle(bundleName));
        let asset = await <Promise<Asset[]>>req.start();
        resReqPool.push(req);
        return asset;
    }

    async apreloadDir(url: string, bundleName?: string) {
        let req = this.createResRequest(Asset);
        this.setupLoadDirRequest(req, url, this.getBundle(bundleName));
        req.setLoadAction(ResRequestLoadAction.Preload);
        await req.start();
        resReqPool.push(req);
    }

    async aloadScene(sceneName: string, option: AssetOption, bundleName?: string) {
        let req = this.createResRequest(SceneAsset);
        this.setupLoadSceneRequeset(req, sceneName, option, this.getBundle(bundleName));
        let asset = await <Promise<SceneAsset>>req.start();
        resReqPool.push(req);
        return asset;
    }

    async apreloadScene(sceneName: string, option: AssetOption, bundleName?: string) {
        let req = this.createResRequest(SceneAsset);
        this.setupLoadSceneRequeset(req, sceneName, option, this.getBundle(bundleName));
        req.setLoadAction(ResRequestLoadAction.Preload);
        await req.start();
        resReqPool.push(req);
    }

    createResRequest<T extends Asset>(assetType: { new(...args): T }) {
        let req = resReqPool.get(assetType);
        return req;
    }

    setupLoadResRequest<T extends Asset>(req: ResRequest<T>, url: string|string[], bundle: AssetManager.Bundle) {
        req.setUrl(url)
            .setBundle(bundle||this.defaultBundle)
            .setType(ResRequestType.Normal)
            .setLoadAction(ResRequestLoadAction.Load);
        return req;
    }

    setupLoadDirRequest<T extends Asset>(req: ResRequest<T>, url: string|string[], bundle: AssetManager.Bundle) {
        req.setUrl(url)
            .setBundle(bundle||this.defaultBundle)
            .setType(ResRequestType.Directory)
            .setLoadAction(ResRequestLoadAction.Load);
        return req;
    }

    setupLoadSceneRequeset(req: ResRequest<SceneAsset>, sceneName: string, option: AssetOption, bundle: AssetManager.Bundle) {
        req.setUrl(sceneName)
            .setBundle(bundle||this.defaultBundle)
            .setType(ResRequestType.Scene)
            .setLoadAction(ResRequestLoadAction.Load)
            .setAssetOption(option);
        return req;
    }
}

export enum ResRequestType {
    Normal,
    Directory,
    Scene,
}

export enum ResRequestLoadAction {
    Load,
    Preload,
}

export class ResRequest<T extends Asset> implements IResRequestBase {
    assetType: { new(...args): T };
    reqType: ResRequestType;
    loadAction: ResRequestLoadAction;
    url: string | string[];
    bundle: AssetManager.Bundle;
    allAssets: T[] = [];
    finished: number;
    total: number;
    error: any;
    assetOption: AssetOption = {
        reloadAsset: false,
        cacheAsset: false
    };
    @asDelegate
    onComplete: IDelegate<(req: Readonly<ResRequest<T>>) => void>;
    @asDelegate
    onProgress: IDelegate<(req: Readonly<ResRequest<T>>) => void>;

    get mainAsset() { return this.allAssets[0]; }

    private _isDone: boolean;
    get isDone() { return this._isDone; }

    private _pending: Promise<T[]>;
    get pending() { return this._pending; }

    get isSuccessful() { return !this.error; }

    start() {
        if (this._pending != void 0)
            return this._pending;
        let p: Promise<any>;
        if (this.isDone) {
            p = Promise.resolve()
                .then(
                    () => new Promise<T[]>((resolve, reject) => {
                        if (!this.isSuccessful) {
                            reject(this.error);
                        } else {
                            resolve(this.allAssets.concat());
                        }
                    })
                );
        } else {
            switch (this.loadAction) {
                case ResRequestLoadAction.Load:
                    p = this._startLoad();
                    break;
                case ResRequestLoadAction.Preload:
                    p = this._startPreload();
                    break;
                default:
                    p = Promise.resolve().then(() => ([]));
            }
        }
        this._pending = p;
        return p;
    }

    setType(type: ResRequestType) {
        this.reqType = type;
        return this;
    }

    setLoadAction(action: ResRequestLoadAction) {
        this.loadAction = action;
        return this;
    }

    setUrl(url: string|string[]) {
        this.url = url;
        return this;
    }

    setBundle(bundle: AssetManager.Bundle) {
        this.bundle = bundle;
        return this;
    }

    setAssetOption(option: AssetOption) {
        this.assetOption.reloadAsset = option.reloadAsset;
        this.assetOption.cacheAsset = option.cacheAsset;
        return this;
    }

    dispose() {
        this.reqType = ResRequestType.Normal;
        this.loadAction = ResRequestLoadAction.Load;
        this.url = null;
        this.bundle = null;
        this.allAssets.length = 0;
        this.finished = 0;
        this.total = 1;
        this.error = null;
        this.assetOption.reloadAsset = false;
        this.assetOption.cacheAsset = false;
        this.onComplete.clear();
        this.onProgress.clear();
        this._pending = null;
        this._isDone = false;
    }

    private _startLoad() {
        let completeFunc: LoadCompleteCallback<T>;
        let p = new Promise<T[]>((resolve, reject) => {
            completeFunc = (error: any, asset?: T | T[]) => {
                if (error != void 0) {
                    reject(error)
                } else {
                    let assets = asset instanceof Array ? asset : [asset];
                    this._completeCallback(error, asset);
                    resolve(assets);
                }
            }
        });
        switch (this.reqType) {
            case ResRequestType.Normal:
                this.bundle.load<T>(
                    <any>this.url,
                    this.assetType,
                    this._progressCallback.bind(this),
                    completeFunc
                );
                break;
            case ResRequestType.Directory:
                this.bundle.loadDir<T>(
                    <any>this.url,
                    this.assetType,
                    this._progressCallback.bind(this),
                    completeFunc
                );
                break;
            case ResRequestType.Scene:
                this.bundle.loadScene(
                    <any>this.url,
                    this.assetOption,
                    this._progressCallback.bind(this),
                    (err: any, sceneAsset: SceneAsset) => completeFunc(err, <any>sceneAsset)
                );
                break;
        }
        return p;
    }

    private _startPreload() {
        let completeFunc: PreloadCompleteCallback;
        let p = new Promise<AssetManager.RequestItem[]>((resolve, reject) => {
            completeFunc = (error: any, resItems: AssetManager.RequestItem[]) => {
                if (error != void 0) {
                    reject(error);
                } else {
                    resolve(resItems);
                }
            }
        });
        switch (this.reqType) {
            case ResRequestType.Normal:
                this.bundle.preload(
                    this.url,
                    completeFunc
                );
                break;
            case ResRequestType.Directory:
                this.bundle.preloadDir(
                    <string>this.url,
                    completeFunc
                );
                break;
            case ResRequestType.Scene:
                this.bundle.preloadScene(
                    <string>this.url,
                    completeFunc
                );
                break;
        }
        return p;
    }

    private _completeCallback(error: Error | null | undefined, asset?: T | T[]) {
        this._isDone = true;
        this.error = error;
        if (this.error != void 0) {
            this.allAssets.length = 0;
            this.onComplete.entry(this);
            return;
        }
        let isAssetArray = asset instanceof Array;
        if (isAssetArray) {
            let assets = <T[]>asset;
            this.allAssets.length = assets.length;
            for (let i = 0, len = assets.length; i < len; ++i)
                this.allAssets[i] = assets[i];
        } else {
            this.allAssets.length = 1;
            this.allAssets[0] = <T>asset;
        }
        this._saveAsset();
        this.onComplete.entry(this);
        this.onComplete.clear();
        this.onProgress.clear();
    }

    private _saveAsset() {
        switch (this.reqType) {
            case ResRequestType.Normal:
                {
                    if (this.url instanceof Array) {
                        let urls = <string[]>this.url;
                        for (let i = 0, len = Math.min(this.allAssets.length, urls.length); i < len; ++i) {
                            resHolder.add(this.allAssets[i], urls[i]);
                        }
                    } else {
                        resHolder.add(this.allAssets[0], <string>this.url);
                    }
                }
                break;
            case ResRequestType.Directory:
                {
                    let url = <string>this.url;
                    for (let i = 0, len = this.allAssets.length; i < len; ++i) {
                        let asset = this.allAssets[i];
                        resHolder.add(asset, `${url}/${asset.name}`);
                    }
                }
                break;
        }
    }

    private _progressCallback(finished: number, total: number, _: any) {
        this.finished = finished;
        this.total = total;
        this.onProgress.entry(this);
    }
}

class ResRequestPool {
    dic: Map<string, IResRequestBase[]> = new Map();

    get<T extends Asset>(assetType: { new(...args): T }): ResRequest<T> {
        let list = this._getList(assetType.name);
        if (list.length > 0)
            return <ResRequest<T>>list.pop();
        else {
            let req = new ResRequest<T>();
            req.assetType = assetType;
            return req;
        }
    }

    push<T extends Asset>(item: ResRequest<T>) {
        let list = this._getList(item.assetType.name);
        item.dispose();
        list.push(item);
    }

    private _getList(key: string) {
        let list = this.dic.get(key);
        if (list == void 0)
            this.dic.set(key, list = []);
        return list;
    }
}

let resReqPool = new ResRequestPool();