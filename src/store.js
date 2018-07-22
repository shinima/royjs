import Events from './events';
import ObservableModel from './observe-model';

let globalStore;

class Store extends Events {
    static create = function (params) {
        const { name, state, actions } = params;
        Object.keys(state).forEach(key => {
            globalStore.set(`${name}.${key}`, state[key]);
        });
        globalStore._wrapActions(actions, globalStore.get(name), name);
        return globalStore.get(name);
    }
    static get = function () {
        return globalStore;
    }
    // state
    // actions
    constructor(params, options = {}) {
        super(params, options);
        const { state, actions } = params;
        const { strict, plugins = [] } = options;
        this.model = new ObservableModel(state);
        this.model.on('get', args => {
            this.trigger('get', args);
        });
        this.model.on('change', (args = {}) => {
            args.value = this.model.get(args.key);
            this.trigger('change', args);
        });
        this.state = state;
        this.actions = {};
        this._strictMode = strict;
        this._wrapActions(actions, this.model);
        plugins.forEach(plugin => {
            plugin(this);
        });
        if (!globalStore) {
            globalStore = this;
        }
    }
    get(key) {
        return this.model.get(key);
    }
    set(key, value, options) {
        if (this._strictMode && !this._allowModelSet) {
            throw new Error('Can only set model by actions');
        }
        return this.model.set(key, value, options);
    }
    _wrapActions(actions, state, prefix) {
        Object.keys(actions).forEach(type => {
            const actionType = prefix ? `${prefix}.${type}` : type;
            this.actions[actionType] = (payload) => {
                const action = actions[type];
                const ret = action(state, payload, { put: this.put });
                this.trigger('actions', {
                    type,
                    payload,
                    state: this.model
                });
                return ret;
            };
        });
    }
    dispatch(type, payload) {
        const action = this.actions[type];
        action(payload);
    }
    put = (type, payload) =>{
        this._allowModelSet = true;
        const action = this.actions[type];
        if (typeof action === 'function') {
            action(payload);
        }
        this._allowModelSet = false;
    }
    subscribe(callback) {
        this.on('actions', function({type, payload, state}) {
            callback({type, payload, state});
        });
    }
}


export default Store;
