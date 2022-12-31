import { Functional } from "./Description.mjs";

const DUMYY_MODULE_NAME = "@@Dummy_Module@@";
class FuncModule {
	arrFunc;
	selfName;
	nextModule; //linked list of FuncModule
    /**
     * 
     * @param {string} moduleName 
     */
    constructor(moduleName) {
        this.arrFunc = new Array();
        this.selfName = moduleName;
        this.nextModule = null;
    }
    /**
     * 
     * @param {FuncHashNode} funcNode 
     */
    add = (funcNode) =>{
        if(!this.contains(funcNode.funcName))
            this.arrFunc.push(funcNode);
    }
    /**
     * 
     * @param {string} funcName 
     * @returns boolean;
     */
	contains = (funcName) => {
		let bResult = false;
		for(let iFunc = 0; iFunc < this.arrFunc.length; iFunc++){
			bResult = this.arrFunc.at(iFunc).funcName == funcName;
			if(bResult)
				break;
		}
		return bResult;
	}

}
class FuncHashNode {
    /**
     * 
     * @param {string} funcName 
     * @param {Functional} funcInfo 
     */
    constructor(funcName, funcInfo) {
        this.hasModule = (funcName.indexOf('.') > - 1);
        if(!this.hasModule){
            funcName = DUMYY_MODULE_NAME + '.' + funcName;
        }
        let nameLength = funcName.charAt(funcName.length - 1) == ':' ? funcName.length - 1 : funcName.length;
        this.funcName =  funcName.substring(0, nameLength);
        this.funcInfo = funcInfo;
    }
    /**
     * 
     * @param {number} sourceId 
     */
    setSourceId = (sourceId) => {
        this.sourceId = sourceId;
    }
    /**
     * 
     * @param {number} hashKey 
     */
    setHashKey = (hashKey) =>{
        this.hashKey = hashKey;
    }
	funcName;
	funcInfo;
	hasModule;
	sourceId;
    hashKey;
}

class HashIndex {
    /**
     * 
     * @param {number} init_capacity 
     */
    constructor(init_capacity){
        this.table = new Array(init_capacity)
        this.moduleIndex = new Array(init_capacity);
    }
    table;
    moduleIndex;
    
    /**
     * 
     * @param {FuncModule} moduleHead 
     */
    saveModule = (moduleHead) => {
        if(!this.moduleIndex.includes(moduleHead))
            this.moduleIndex.push(moduleHead);
    }
    /**
     * 
     * @param {FuncHashNode} funcNode 
     */
    add = (funcNode) => {
        let moduleHead = this.table[funcNode.hashKey];
        let arrString = funcNode.funcName.split('.', 2); //module and funcName
        let moduleName = arrString[0];
        funcNode.funcName = arrString[1];
        funcNode.hashKey = this.getHashCode(moduleName);

        if(moduleHead == null){
            moduleHead = new FuncModule(moduleName);
            this.table[funcNode.hashKey] = moduleHead;
            if(funcNode.hasModule)
                this.saveModule(moduleHead);
        }
        else {
            while(moduleHead.nextModule != null && moduleHead.selfName != moduleName)
                moduleHead = moduleHead.nextModule;
            if(moduleHead.selfName != moduleName){
                moduleHead.nextModule = new FuncModule(moduleName);
                moduleHead = moduleHead.nextModule;
                if(funcNode.hasModule)
                    this.saveModule(moduleHead); //save moduleHead in Index array
            }
        }
        moduleHead.add(funcNode);
    
    }
    /**
     * 
     * @param {string} moduleName 
     */
    getHashCode = (moduleName) => {
        let sum = 0;
        let factor = 13;
        for(let i = 0; i < moduleName.length; i++)
            sum += moduleName.charCodeAt(i) * factor;
        return sum % this.table.length;
    }
    /**
     * 
     * @param {string} moduleName 
     * @returns {FuncModule}
     */
    getModule = (moduleName) => {
        let iTable = this.getHashCode(moduleName);
        let moduleHead = this.table[iTable];
        if(moduleHead != null){
            while(moduleHead.nextModule != null && moduleHead.selfName != moduleName){
                moduleHead = moduleHead.nextModule;
            }
            if(moduleHead.selfName != moduleName)
                moduleHead = null;
        }
        return moduleHead;
    }
    /**
     * 
     * @param {string} moduleName 
     * @returns {FuncModule[]} 
     */
    getModules = (moduleName) => {
        let dummyHeads = new Array();
        let probeHead = this.getModule(moduleName);
        if(probeHead == null){
            this.moduleIndex.forEach( (moduleHead) => {
                if(moduleHead.selfName.includes(moduleName))
                    dummyHeads.push(moduleHead);
            })
        }
        else {
            dummyHeads.push(probeHead);
        }
        return dummyHeads;

    }
}


export {
    FuncModule,
    FuncHashNode,
    HashIndex,
    DUMYY_MODULE_NAME
}