
const vscode = require('vscode');
const LANG_NAME = 'fasm-x86_64';
const CONFIG_HEADER = 'fasm';

let CompillerPath;
const INDEX_FILE_CNT = 300;
const MAX_FUNC_MODULE_CNT = 100;
const SEARCH_EXT = ['.fasm', '.asm', '.inc'];
const IGNORE_FILES = [];
const DUMYY_MODULE_NAME = "@@Dummy_Module@@";

const getHashCode = (moduleName) => {
	return (hash(moduleName) / 2 + hash(moduleName) << 2) % MAX_FUNC_MODULE_CNT;
}
const getFuncInfo = (funcName) => {
	let hasModule = (funcName.indexOf('.') > - 1);
	let moduleName = DUMYY_MODULE_NAME;
	let funcInfo = new FuncInfo();
	funcInfo.hasModule = hasModule;
	if(hasModule){
		let arrString = funcName.split('.', 2);
		moduleName = arrString[0];
	}
	funcInfo.hashKey = getHashCode(moduleName);
	funcInfo.funcName = funcName;
	return funcInfo;
}
class FuncModule {
	arrFunc;
	selfName;
	nextModule; //linked list of FuncModule

}
const getFuncModule = (selfHash) => {
	let head = new FuncModule();
	head.selfHash = selfHash;
	return  head;
}
class FuncInfo {
	hashKey;
	funcName;
	funcInfo;
	hasModule;
}
const hashTable = new Array(MAX_FUNC_MODULE_CNT);

const addToTable = (funcInfo) => {
	let moduleHead = hashTable.at(funcInfo.hashKey);
	let moduleName = funcInfo.hasModule ? funcInfo.split('.', 2)[0] : DUMYY_MODULE_NAME;
	if(moduleHead == null){
		moduleHead = new FuncModule();
		hashTable[funcInfo.hashKey] = moduleHead;
		moduleHead.selfName = moduleName;
	}
	else {
		while(moduleHead.nextModule != null && moduleHead.selfName != moduleName)
			moduleHead = moduleHead.nextModule;
		if(moduleHead.selfName != moduleName){
			moduleHead.nextModule = new FuncModule();
			moduleHead = moduleHead.nextModule;
			moduleHead.selfName = moduleName;
		}
	}
	if(moduleHead.arrFunc == null){
		moduleHead.arrFunc = new Array();
	}
	moduleHead.arrFunc.push(funcInfo);

}
class GoWorkspaceSymbolProvider  {
    provideWorkspaceSymbols(query, token){
		arrResult = new vscode.SymbolInformation();
    }
}

const STR_DOCS_START = 'Input:';
const STR_DOCS_END	 = ';\n';
const getDocsBlock = (buffString, offset) => {
	let iStart = buffString.indexOf(STR_DOCS_START, offset);
	if(iStart == -1)
		return null;
	let iEnd = buffString.indexOf(STR_DOCS_END, iStart);
	if(iEnd == -1)
		return null;
	return buffString.substring(iStart, iEnd);
}
const getFirstName = (buffString, offset) => {
	let iStart = offset; //the start of name
	let iEnd = iStart + 1;
	while(iEnd < (buffString.length + offset) && buffString.charAt(iEnd) != ' ' && buffString.charAt(iEnd) != '\n')
		iEnd++;
	return buffString.substring(iStart, iEnd - 1);
}
const DEFAULT_LINE_CNT = 20; //num of charachters
//if error return -1
//else return 0;
const addToIndex = (fHandle) => {
	let buffString;
	let restRange;
	let currLine;
	let rangeChanged;
	let range = new vscode.Range(
		new vscode.Position(0, 0),
		new vscode.Position(DEFAULT_LINE_CNT, 0)
	)
	do {
		restRange = fHandle.validateRange(range);
		rangeChanged = (restRange != range);
			buffString = fHandle.getText(range);
			while(currLine < restRange.end().line()){
				let buffDocs = getDocsBlock(buffString, currLine);
				if(buffDocs == null || buffString.length < currLine + buffDocs.length + 1)
					break;
				let funcName = getFirstName(buffString, currLine + buffDocs.length)
				currLine += funcName.length + buffDocs.length + 1;
				let funcInfo = getFuncInfo(funcName);
				funcInfo.funcInfo = buffDocs;
				addToTable(funcInfo);
			}
		range = new vscode.Range(
			new vscode.Position(range.start().line() + DEFAULT_LINE_CNT, 0),
			new vscode.Position(range.end().line() + DEFAULT_LINE_CNT, 0),	
		);
	}while(!rangeChanged);

}
const initIndex = () => {
	let filesPromise = vscode.workspace.findFiles("*.asm", undefined, INDEX_FILE_CNT);
	const rejectedFunc = (reason) => {
		vscode.window.showInformationMessage(reason)
	};
	const arrayFunc = (arrFiles) => {
		if(arrFiles.length == 0){
			vscode.window.showInformationMessage('No source file to index');
		}
		arrFiles.forEach((fileUri) => {
			fHandle = vscode.workspace.openTextDocument(fileUri);
			fHandle.then((file) => addToIndex(file))

		});
	}
	filesPromise.then(arrayFunc, rejectedFunc);

	


};
const initGlobals = () => {
	WorkDirectoryPath = vscode.workspace.workspaceFolders[0].uri.path;
	CompillerPath = vscode.workspace.getConfiguration(CONFIG_HEADER).get('compiller');
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	initGlobals();
	let disposable = vscode.commands.registerCommand('fasm.initIndex', initIndex);	
	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.languages.registerWorkspaceSymbolProvider(
			new GoWorkspaceSymbolProvider()
		)
	)

	vscode.languages.registerHoverProvider(LANG_NAME,{
		provideHover(document, position, token){
			return {
				contents: ['Hover content']
			};
		}
	});
}




function deactivate() {}

module.exports = {
	activate,
	deactivate
}
