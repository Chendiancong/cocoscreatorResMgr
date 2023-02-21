class _funLinker {
    value: Function = null;
    next: _funLinker = null;
    prev: _funLinker = null;
    thiz: any = null;
}

export interface IDelegate<FunType extends Function> {
    get entry(): FunType;
    add(f: FunType, thiz?: any);
    remove(f: FunType, thiz?: any);
    clear();
}

export class Delegate<FunType extends Function> implements IDelegate<FunType> {
    _tag: string = "_delegate_";
    _head: _funLinker;
    _tail: _funLinker;

    get entry() {
        return this._head.value as FunType;
    }

    constructor() {
        const fl = new _funLinker;
        fl.value = function() {
            let cur = fl.next;
            while (cur != this._tail) {
                if (typeof cur.value == "function") {
                    if (cur.thiz != void 0)
                        cur.value.call(cur.thiz, ...arguments);
                    else
                        cur.value(...arguments);
                }
                cur = cur.next;
            }
        }
        this._head = fl;
        this._tail = new _funLinker;
        this._head.next = this._tail;
        this._tail.prev = this._head;
    }

    add(f: FunType, thiz?: any) {
        let cur = this._head.next;
        thiz = thiz === undefined ? null : thiz;
        while (cur != this._tail) {
            if (cur.value === f && thiz === cur.thiz)
                return;
            cur = cur.next;
        }
        const linker = new _funLinker;
        linker.value = f;
        linker.thiz = thiz;
        const prev = this._tail.prev;
        prev.next = linker;
        linker.prev = prev;
        linker.next = this._tail;
        this._tail.prev = linker;
    }

    remove(f: FunType, thiz?: any) {
        let cur = this._head.next;
        thiz = thiz === undefined ? null : thiz;
        while (cur != this._tail) {
            if (cur.value === f && thiz === cur.thiz) {
                const prev = cur.prev;
                const next = cur.next;
                prev.next = next;
                next.prev = prev;
                break;
            }
            cur = cur.next;
        }
    }

    clear() {
        this._head.next = this._tail;
        this._tail.prev = this._head;
    }
}

function getDelegate<FunType extends Function>(thiz: any, key: string): Delegate<FunType> {
    let del = thiz[key];
    if (del == void 0) {
        del = thiz[key] = new Delegate<FunType>();
    }
    return del;
}

/**委托 */
export function asDelegate(classOrProto: any, propName: string) {
    let key1 = `${propName}_delegate`;
    let desc: PropertyDescriptor = {
        get: function() {
            return getDelegate<any>(this, key1);
        },
        set: function(value) {
            let del = getDelegate<any>(this, key1);
            if (value == void 0) {
                del.clear();
            } else if (value._tag == "_delegate_") {
                del._head = value._head;
                del._tail = value._tail;
            } else {
                console.warn(`set delegate type error`);
            }
        }
    }
    return desc as any;
}