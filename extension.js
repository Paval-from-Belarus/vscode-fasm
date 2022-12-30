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

//Automatically parse input string onto sequence
class FuncInfo {
	strInput;
	strOutput;
	strNotes;
	FuncInfo(strInfo){
		
	}
}
class FuncModule {
	arrFunc;
	selfName;
	nextModule; //linked list of FuncModule
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
class FuncInfo {
	hashKey;
	funcName;
	funcInfo;
	hasModule;
	sourceId;
}
const hashTable = new Array(MAX_FUNC_MODULE_CNT);
const arrFiles = new Array(INDEX_FILE_CNT);

//return null if module is not exists
const getModuleHead = (moduleName) => {
	let iTable = getHashCode(moduleName);
	let moduleHead = hashTable.at(iTable);
	if(moduleHead != null){
		while(moduleHead.nextModule != null && moduleHead.selfName != moduleName){
			moduleHead = moduleHead.nextModule;
		}
		if(moduleHead.selfName == moduleName)
			return moduleHead;
	}
	return null;
}


let lastFileIndex = -1;
const addToTable = (funcInfo) => {
	let moduleHead = hashTable.at(funcInfo.hashKey);
	let moduleName;
	if(funcInfo.hasModule){
		let strBuffer = funcInfo.funcName.split('.', 2);
		moduleName = strBuffer[0];
		funcInfo.funcName = strBuffer[1];
	}
	else {
		moduleName = DUMYY_MODULE_NAME;
	}
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
	if(!moduleHead.contains(funcInfo.funcName))
		moduleHead.arrFunc.push(funcInfo);
	else 
		{
			let x = 10;
			x += 12;
		}

}
class GoWorkspaceSymbolProvider  {
    provideWorkspaceSymbols(query, token){
		arrResult = new vscode.SymbolInformation();
    }
}

const convertFuncInfo = () => {

}
//funcName is part of whole name
//insert part name 
getCompletionItems = (moduleName, funcName) => {
	let moduleHead = getModuleHead(moduleName);
	let arrItems = new Array();
	if(moduleHead == null)
		return null;
	moduleHead.arrFunc.forEach( (funcInfo) => {
		if(funcInfo.funcName.includes(funcName) ) { //skip module name
				arrItems.push(
					new vscode.CompletionItem(funcInfo.funcName, vscode.CompletionItemKind.Function)
				);
		}
	})
	return arrItems;
}
class HoverProvider {
	provideHover(document, position, token){

		return {
			contents: ['Hover content']
		};
	}
}
class CompletionItemProvider {

	arrString;
	extract = (document, cursorPos) => {
		let strBuffer = document.lineAt(cursorPos.line).text;
		let iEnd = cursorPos.character - 1;
		let iStart = iEnd;
		while(iStart > 0 && strBuffer.charAt(iStart - 1) != ' ')
			iStart--;

		this.arrString = strBuffer.substring(iStart, iEnd + 1).split('.', 2);
	}
	//it can be only part of real module name
	extractModule = () => {
		let moduleName;
		if(this.arrString.length == 1 || this.arrString[0].length == 0)
			moduleName == null;
		else
			moduleName = this.arrString[0];
								//it's not module because module always starts with 
								//upperCase letter
		return moduleName;
	}
	extractLabel = () => {
		let lblName;
		if(this.arrString.length == 1){
			lblName = this.arrString[0];
		}
		else {
			lblName = this.arrString[1];
		}
		return lblName;
	}
    provideCompletionItems(
        document, position, token){
			this.extract(document, position);
			let moduleName = this.extractModule();
			if(moduleName == null)
				moduleName = DUMYY_MODULE_NAME;
			let funcName = this.extractLabel();
			let arrItems = getCompletionItems(moduleName, funcName);
			return arrItems;
    }
}
const STR_DOCS_START = ';Input:';
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

//if error return -1
//else return 0;
const addToIndex = (fHandle) => {
	let currLine = 0;
	let lineCnt = fHandle.lineCount;

	while(currLine < lineCnt){
		let buffDocs = null;
		while(buffDocs == null && currLine < lineCnt){
			buffDocs = getDocsBlock(fHandle, currLine, lineCnt);
			currLine++;
		}	
		if(buffDocs == null || lineCnt < buffDocs.nextLine)
			break;
		currLine = buffDocs.nextLine;
		let funcName = getFirstName(fHandle, currLine++);
		if(funcName.charAt(0) != '.'){
			let funcInfo = getFuncInfo(funcName);
			funcInfo.funcInfo = buffDocs.block;
			addToTable(funcInfo);
		}
	}


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
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            LANG_NAME, new CompletionItemProvider(), ['.']));

	vscode.languages.registerHoverProvider(LANG_NAME, new HoverProvider());
}




function deactivate() {}

module.exports = {
	activate,
	deactivate
}
