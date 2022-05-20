declare interface IDelegate<FunType extends Function> {
    get entry(): FunType;
    add(f: FunType, thiz?: any);
    remove(f: FunType, thiz?: any);
    clear();
}