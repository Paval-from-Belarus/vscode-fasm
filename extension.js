import { LANG_NAME, CONFIG_HEADER } from './src/General.js';
const vscode = require('vscode');


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
	let funcInfo = new FuncHashNode();
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
//format of strInfo: <;Input:... ;Ouput:...;Notes:...>

class DescriptionStage {
	static InfoPart = 0;
	static InputPart = 1;
	static OutputPart = 2;
	static NotesPart = 3;
	static AssumePart = 4;
}
class FuncDescription {
	static exctractInputInfo = (arrInfo) => {

	}
	static extractOutputInfo = (arrInfo) => {

	}
	static extractAuxInfo = (arrInfo) => {

	}
	static INPUT_LABEL 	= 'Input';
	static OUTPUT_LABEL = 'Output';
	static NOTE_LABEL	= 'Notes';
	static ASSUME_LABEL	= 'Assume';
	
	getStage = (strLabel) => {
		switch(strLabel){
			case FuncDescription.INPUT_LABEL:
				return DescriptionStage.InputPart;
			case FuncDescription.OUTPUT_LABEL:
				return DescriptionStage.OutputPart;
			case FuncDescription.ASSUME_LABEL:
				return DescriptionStage.AssumePart;
			case FuncDescription.NOTE_LABEL:
				return DescriptionStage.NotesPart;
			default:
				return DescriptionStage.InfoPart;
		}
	}
	savePart = (stage, arrInfo) => {
		switch(stage){
			case DescriptionStage.InputPart:
				this.strInput = FuncDescription.exctractInputInfo(arrInfo);
				break;
			case DescriptionStage.OutputPart:
				this.strOutput = FuncDescription.extractOutputInfo(arrInfo);
				break;
			case DescriptionStage.AssumePart:
			case DescriptionStage.NotesPart:
				this.strNotes = FuncDescription.extractAuxInfo(arrInfo);
			default:
				console.log('Unknown stage');
		}
	}
	constructor (rawInfo){


		let currStage = DescriptionStage.InfoPart;
		let relOffset = 0;
		let strLabel = null;
		let arrInfoPart = new Array();
		for(let i = 0; i < rawInfo.length; i++){
			switch(rawInfo.charAt(i)){
				case ';':
					if(relOffset != 0){
						arrInfoPart.push(rawInfo.substring(i - relOffset, i));
					}
					relOffset = 0;
					break;
				case '\n':
				case '\r':
					relOffset = 0;
					break;
				case ':':
					let updStage = this.getStage(rawInfo.substring(i - relOffset, i));
					currStage = (updStage != DescriptionStage.InfoPart) ? updStage : currStage;
					if(currStage == updStage && arrInfoPart.length != 0){
						this.savePart(currStage, arrInfoPart);				
						arrInfoPart = new Array();
					}
					break;
				default:
					relOffset += 1;
			}
		}	
		if(arrInfoPart.length != 0)
			this.savePart(currStage, arrInfoPart);	
	}

	strInput = null;
	strOutput = null;
	strNotes = null;
	getHover = () => {
		let result = new vscode.Hover([this.strInput, '|', this.strOutput]);
		return result;
	}
	getCompletion = () => {

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
class FuncHashNode {
	hashKey;
	funcName;
	funcInfo;
	hasModule;
	sourceId;
}
const hashTable = new Array(MAX_FUNC_MODULE_CNT);
const arrFiles = new Array(INDEX_FILE_CNT);
const arrModules = new Array(); // Index of modules
//pointer to moduleHead
const saveModuleHead = (moduleHead) => {
	if(!arrModules.includes(moduleHead))
		arrModules.push(moduleHead);

}
//moduleName can be not completed name
//return array of similar heads
const getSimilarHeads = (moduleName) => {
	let dummyHeads = new Array();
	let probeHead = getModuleHead(moduleName);
	if(probeHead == null){
		for(let i = 0; i < arrModules.length; i++){
			if(arrModules[i].selfName.includes(moduleName)){
				dummyHeads.push(arrModules[i]);
			}
		}
	}
	else {
		dummyHeads.push(probeHead);
	}
	return dummyHeads;
}

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
		if(funcInfo.hasModule)
			saveModuleHead(moduleHead);
	}
	else {
		while(moduleHead.nextModule != null && moduleHead.selfName != moduleName)
			moduleHead = moduleHead.nextModule;
		if(moduleHead.selfName != moduleName){
			moduleHead.nextModule = new FuncModule();
			moduleHead = moduleHead.nextModule;
			moduleHead.selfName = moduleName;
			if(funcInfo.hasModule)
				saveModuleHead(moduleHead); //save moduleHead in Index array
		}
	}
	if(moduleHead.arrFunc == null){
		moduleHead.arrFunc = new Array();
	}
	if(!moduleHead.contains(funcInfo.funcName))
		moduleHead.arrFunc.push(funcInfo);
	else {
		let x = 10;
		x += 23;
	}

}

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
	let moduleHead = getModuleHead(moduleName);
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
			let arrModules = getSimilarHeads(moduleName);
			let arrItems = new Array();
			arrModules.forEach( (moduleHead) => {
				arrItems.push(
					new vscode.CompletionItem(moduleHead.selfName, vscode.CompletionItemKind.Class)
				)
			});
			return arrItems;
	}
	getFuncItems = (moduleName, funcName) => {
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
				moduleName = DUMYY_MODULE_NAME;
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
		if(funcName.charAt(0) != '.'){
			let funcInfo = getFuncInfo(funcName);
			funcInfo.funcInfo = new FuncDescription(buffDocs.block);
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
        vscode.languages.registerCompletionItemProvider(
            LANG_NAME, new CompletionItemProvider(), '.'));

	vscode.languages.registerHoverProvider(LANG_NAME, new HoverProvider());
}




function deactivate() {}

module.exports = {
	activate,
	deactivate
}
