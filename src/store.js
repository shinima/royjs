import Events from './events';
import ObservableModel from './observe-model';
import DataSource from './data-source';

let globalStore;

class Store extends Events {
    static create = function (store, params) {
        if (!params) {
            params = store;
            store = globalStore;
        }
        const { name, state, actions } = params;
        Object.keys(state).forEach(key => {
            store.set(`${name}.${key}`, state[key]);
        });
        store._wrapActions(actions, store.get(name), name);
        return store.get(name);
    }
    static mount = function (name, store) {

    }
    static get = function () {
        return globalStore;
    }
    // state
    // actions
    constructor(params = {}, options = {}) {
        super(params, options);
        let { name, state, actions = {} } = params;
        const { strict, plugins = [] } = options;
        state = {
            ...this.state,
            ...state
        };
        this.model = new ObservableModel(state, this);
        this.model.on('get', args => {
            this.trigger('get', args);
        });
        this.model.on('change', (args = {}) => {
            args.value = this.model.get(args.key);
            this.trigger('change', args);
        });
        this.actions = {};
        this._strictMode = strict;
        this._wrapActions(actions, this.model);
        this.state = this.model;
        this.url = options.url;
        this.name = name;
        this.primaryKey = options.primaryKey || 'id';
        plugins.forEach(plugin => {
            plugin(this);
        });
        if (!globalStore) {
            globalStore = this;
        }
    }
    get dataSource() {
        return new DataSource({
            url: this.url,
            primaryKey: this.primaryKey
        });
    }
    get request() {
        return this.dataSource.request;
    }
    get(key) {
        return this.model.get(key);
    }
    set(key, value, options = {}) {
        if (this._strictMode && !this._allowModelSet) {
            // throw new Error('Can only set model by actions');
            this.strict = true;
        }
        return this.model.set(key, value, options);
    }
    _wrapActions(actions, state, prefix) {
        const that = this;
        Object.keys(actions).forEach(type => {
            const actionType = prefix ? `${prefix}.${type}` : type;
            this.actions[actionType] = (payload) => {
                const action = actions[type];
                const ret = action.call(this, payload, state);
                this.trigger('actions', {
                    type: actionType,
                    payload,
                    state: this.model
                });
                return ret;
            };
            Object.defineProperty(this, actionType, {
                get() {
                    return that.actions[actionType];
                }
            });
        });
    }
    dispatch(type, payload) {
        const action = this.actions[type];
        if (!action || typeof action !== 'function') {
            throw new Error('Cant find ${type} action');
        }
        this._allowModelSet = true;
        const ret = action(payload);
        this._allowModelSet = false;
        return ret;
    }
    subscribe(callback) {
        this.on('actions', function ({type, payload, state}) {
            callback({type, payload, state});
        });
    }
    create(params) {
        return Store.create(this, params);
    }
    mount(name, store) {
        if (!store) {
            store = name;
            name = store.name;
        }
        let {state, actions} = store;
        store.on('change', args => {
            this.set(`${name}.${args.key}`, args.value);
        });
        store.on('get', args => {
            const obj = {...args};
            obj.key = `${name}.${obj.key}`;
            this.trigger('get', obj);
        });
        return Store.create(this, {
            name,
            state: state.toJSON(),
            actions
        });
    }
}

export default Store;

export const create = Store.create;

export const get = Store.get;
