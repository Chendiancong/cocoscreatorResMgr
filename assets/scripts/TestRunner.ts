import { _decorator, Component, Node, Prefab, instantiate, Asset } from 'cc';
import { ResMgr, ResRequest } from '../resMgr/resMgr';
const { ccclass, property } = _decorator;

@ccclass('TestRunner')
export class TestRunner extends Component {
    resMgr: ResMgr = new ResMgr();

    async testLoadAndInstantiate1() {
        let prefab = (await this.resMgr.aloadRes("Cube", Prefab))[0];
        let node = instantiate(prefab);
        node.parent = this.node;
        node.setPosition(0, 0, 0);
    }

    testLoadAndInstantiate2() {
        let req = this.resMgr.createResRequest(Prefab);
        this.resMgr.setupLoadResRequest(req, "Cylinder", this.resMgr.defaultBundle);
        req.onProgress.add(this._onLoadProgress, this);
        req.onComplete.add(this._onLoadComplete, this);
        req.start();
    }

    private _onLoadProgress<T extends Asset>(req: ResRequest<T>) {
        console.log(`on load progress: ${req.finished}/${req.total}`);
    }

    private _onLoadComplete<T extends Asset>(req: ResRequest<T>) {
        let asset = req.mainAsset;
        if (asset instanceof Prefab) {
            let node = instantiate(<Prefab>asset);
            node.parent = this.node;
            node.setPosition(1, 0, 0);
        }
    }
}