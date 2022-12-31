const Description = import('./src/Description.mjs');
const HashTable = import('./src/HashTable.mjs');
const General = import('./src/General.mjs');
const vscode = require('vscode');

let CompillerPath;
let WorkDirectoryPath;

const SEARCH_EXT = ['.fasm', '.asm', '.inc'];
const IGNORE_FILES = [];

const saveSourceFile = (fullName) => {
	let iSelf = WorkDirectoryPath.length;
	let fileName = fullName.substring(iSelf + 1, fullName.length);
	arrFiles.push(fileName);
	lastFileIndex++;
}	
const getLastSourceIndex = () => lastFileIndex;


const hashTable = new HashTable.HashIndex(General.MAX_FUNC_MODULE_CNT);
const arrFiles = new Array(General.INDEX_FILE_CNT);
let lastFileIndex = -1;


const convertFuncInfo = (funcInfo) => {
	let lblItem = {
		label: funcInfo.funcName,
		description: funcInfo.funcInfo.strInput + funcInfo.funcInfo.strOutput,
	}
	return lblItem;
}


//Notes: separate user input onto two parts:
	//before dote: <Module>
	//after doate: <Method>
class UserInput {
	static arrString;
	static extract = (document, cursorPos) => {
		let strBuffer = document.lineAt(cursorPos.line).text;
		let iEnd = cursorPos.character - 1;
		let iStart = iEnd;
		while(iStart > 0 && strBuffer.charAt(iStart - 1) != ' ')
			iStart--;

		this.arrString = strBuffer.substring(iStart, iEnd + 1).split('.', 2);
	}
	//it can be only part of real module name
	static extractModule = () => {
		let moduleName;
		if(this.arrString.length == 1 || this.arrString[0].length == 0)
			moduleName == null;
		else
			moduleName = this.arrString[0];
								//it's not module because module always starts with 
								//upperCase letter
		return moduleName;
	}
	static extractMethod = () => {
		let lblName;
		if(this.arrString.length == 1){
			lblName = this.arrString[0];
		}
		else {
			lblName = this.arrString[1];
		}
		return lblName;
	}
}
const getHoverInfo = (moduleName, funcName) => {
	let moduleHead = hashTable.getModule(moduleName);
	if(moduleHead == null || !moduleHead.contains(funcName))
		return null;
	let funcInfo;
	for(let iNode = 0; iNode < moduleHead.arrFunc.length; iNode++){
		if(moduleHead.arrFunc[iNode].funcName == funcName){
			funcInfo = moduleHead.arrFunc[iNode].funcInfo;
			break;
		}
	}
	return funcInfo.getHover();
}
class HoverProvider {
	provideHover(document, position, token){
		let hoverInfo = getHoverInfo('Files', 'readFile');
		return hoverInfo;
	}
}
class CompletionItemProvider {

	getModuleItems = (moduleName) => {
			let arrModules = hashTable.getModules(moduleName);
			let arrItems = new Array();
			arrModules.forEach( (moduleHead) => {
				arrItems.push(
					new vscode.CompletionItem(moduleHead.selfName, vscode.CompletionItemKind.Class)
				)
			});
			return arrItems;
	}
	getFuncItems = (moduleName, funcName) => {
		let moduleHead = hashTable.getModule(moduleName);
		let arrItems = new Array();
		if(moduleHead == null)
			return null;

		moduleHead.arrFunc.forEach( (funcNode) => {
			if(funcNode.funcName.includes(funcName) ) { //skip module name
					arrItems.push(
						new vscode.CompletionItem(funcNode.funcName, vscode.CompletionItemKind.Function)
					);
			}
		})
		return arrItems;
	}
	//funcName is part of whole name
	//insert part name 
	/**
	 * 
	 * @param {string} moduleName 
	 * @param {string | undefined} funcName : if undefined: any method name
	 * @returns suitable CompetionItem (probable null items)
	 */
	getItems = (moduleName, funcName) => {
		let arrItems;
		if(funcName != undefined)
			arrItems = this.getFuncItems(moduleName, funcName);
		else
			arrItems = this.getModuleItems(moduleName);
		return arrItems;
	}
    provideCompletionItems(
        document, position, token){
			let moduleName;
			let funcName;
			let arrItems = new Array();

			UserInput.extract(document, position);
			moduleName = UserInput.extractModule();
			funcName = UserInput.extractMethod();
			if(moduleName == null){
				let moduleItems = this.getItems(funcName, undefined);
				if(moduleItems != null){
					moduleItems.forEach((moduleItem) => {
						arrItems.push(moduleItem)
					})
				}
				moduleName = HashTable.DUMYY_MODULE_NAME;
			}
			this.getItems(moduleName, funcName).forEach((funcItem) => {
				arrItems.push(funcItem)
			})
			
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
		if(funcName.charAt(0) != '.'){ //if not internal label
			let funcNode = new HashTable.FuncHashNode(funcName, 
											new Description.Functional(buffDocs.block));
			funcNode.setSourceId(getLastSourceIndex());
			hashTable.add(funcNode);
		}
	}


}
const initIndex = () => {
	let filesPromise = vscode.workspace.findFiles("*.asm", undefined, General.INDEX_FILE_CNT);
	const rejectedFunc = (reason) => {
		vscode.window.showInformationMessage(reason)
	};
	const arrayFunc = (arrFiles) => {
		if(arrFiles.length == 0){
			vscode.window.showInformationMessage('No source file to index');
		}
		arrFiles.forEach((fileUri) => {
			let fHandle = vscode.workspace.openTextDocument(fileUri);
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
	CompillerPath = vscode.workspace.getConfiguration(General.CONFIG_HEADER).get('compiller');
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	initGlobals();
	let disposable = vscode.commands.registerCommand('fasm.initIndex', initIndex);	
	context.subscriptions.push(disposable);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            General.LANG_NAME, new CompletionItemProvider(), '.'));

	vscode.languages.registerHoverProvider(General.LANG_NAME, new HoverProvider());
}




function deactivate() {}

module.exports = {
	activate,
	deactivate
}
