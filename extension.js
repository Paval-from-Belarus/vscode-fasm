const vscode = require('vscode');
const LANG_NAME = 'fasm-x86_64';
const CONFIG_HEADER = 'fasm';

let CompillerPath;
let WorkDirectoryPath;
const INDEX_FILE_CNT = 300;
const MAX_FUNC_MODULE_CNT = 100;
const SEARCH_EXT = ['.fasm', '.asm', '.inc'];
const IGNORE_FILES = [];
const DUMYY_MODULE_NAME = "@@Dummy_Module@@";

const saveSourceFile = (fullName) => {
	let iSelf = WorkDirectoryPath.length;
	let fileName = fullName.substring(iSelf + 1, fullName.length);
	arrFiles.push(fileName);
	lastFileIndex++;
}	
const getLastSourceIndex = () => lastFileIndex;
const getHashCode = (moduleName) => {
	let sum = 0;
	let factor = 13;
	for(let i = 0; i < moduleName.length; i++)
		sum += moduleName.charCodeAt(i) * factor;
	return sum % MAX_FUNC_MODULE_CNT;
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
	let nameLength = funcName.charAt(funcName.length - 1) == ':' ? funcName.length - 1 : funcName.length;
	funcInfo.funcName =  funcName.substring(0, nameLength);
	funcInfo.sourceId = getLastSourceIndex();
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
	sourceId;
}
const hashTable = new Array(MAX_FUNC_MODULE_CNT);
const arrFiles = new Array(INDEX_FILE_CNT);
let lastFileIndex = -1;
const addToTable = (funcInfo) => {
	let moduleHead = hashTable.at(funcInfo.hashKey);
	let moduleName = funcInfo.hasModule ? funcInfo.funcName.split('.', 2)[0] : DUMYY_MODULE_NAME;
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

const STR_DOCS_START = ';Input:';
const STR_DOCS_END	 = ';\n';
const getDocsBlock = (fHandle, nLine, limitLine) => {
	let startLine = nLine;
	let buffString = fHandle.lineAt(nLine++).text;
	if(buffString.indexOf(STR_DOCS_START) != 0)
		return null;

	while( (nLine < limitLine) && fHandle.lineAt(nLine).text.indexOf(';') != -1)
		nLine++;
	buffString = fHandle.getText(
		new vscode.Range(
			new vscode.Position(startLine, 0),
			new vscode.Position(nLine - 1, 1) 
		)
	)
	return {
		block: buffString,
		nextLine: nLine
	}		
}
const excludeKeyword = 'proc';
const getFirstName = (fHandle, nLine) => {
	let buffString = fHandle.lineAt(nLine).text;
	let arrString = buffString.split(' ', 3);
	let funcName;
	if(arrString[0] == excludeKeyword)
		funcName = arrString[1];
	else
		funcName = arrString[0];
	return funcName;
}
const DEFAULT_LINE_CNT = 20; //num of charachters
//if error return -1
//else return 0;
const addToIndex = (fHandle) => {
	let buffString;
	let restRange;
	let currLine = 0;
	let rangeChanged;
	let range = new vscode.Range(
		new vscode.Position(0, 0),
		new vscode.Position(DEFAULT_LINE_CNT, 0)
	)
	do {
		restRange = fHandle.validateRange(range);
		rangeChanged = (restRange != range);
			while(currLine < restRange.end.line){
				let buffDocs = null;
				while(buffDocs == null && currLine < restRange.end.line){
					buffDocs = getDocsBlock(fHandle, currLine, restRange.end.line);
					currLine++;
				}	
				if(buffDocs == null || restRange.end.line < buffDocs.nextLine)
					break;
				currLine = buffDocs.nextLine;
				let funcName = getFirstName(fHandle, currLine++);
				let funcInfo = getFuncInfo(funcName);
				funcInfo.funcInfo = buffDocs.block;
				addToTable(funcInfo);
			}
		range = new vscode.Range(
			new vscode.Position(range.start.line + DEFAULT_LINE_CNT, 0),
			new vscode.Position(range.end.line + DEFAULT_LINE_CNT, 0),	
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
			fHandle.then((file) => {
				saveSourceFile(file.fileName);
				addToIndex(file);
			})

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
