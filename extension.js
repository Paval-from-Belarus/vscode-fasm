const { ConsoleReporter } = require('@vscode/test-electron');
const system = require('node:os');
const { collapseTextChangeRangesAcrossMultipleVersions } = require('typescript');
const vscode = require('vscode');

const LANG_NAME = 'fasm-x86_64';
const CONFIG_HEADER = 'fasm';
const INDEX_FILE_CNT = 300;
const MAX_FUNC_MODULE_CNT = 100;
//description module
class DescriptionStage {
	static InfoPart = 0;
	static InputPart = 1;
	static OutputPart = 2;
	static NotesPart = 3;
	static AssumePart = 4;
}
class OperationSystem {
	static Win = 0;
	static Linux = 1;
	static Unknown = 2;
}

class SimpleText {
		/**
	 * 
	 * @param {DocsLine[]} arrDocsLine 
	 * @returns {string}
	 */
	static convert = (arrDocsLine) => {
		let strResult = '';
		let title = '';
		arrDocsLine.forEach( (docLine) => {
			if(docLine.hasTitle())
				title = `${docLine.title} ${Keyword.LONG_DASH} `
			strResult = strResult + title + `${docLine.text}\n`;
		});
		return strResult;
	}
}
class MarkdownText {
	
	static toTitle = (/** @type {string} */ strText) => {
		return `### ${strText} \n`
	}
	static toList = (/** @type {string[]} */ arrValues, mode = true) => {
		let result = '';
		let listType = (mode == true) ? '-' : '';
		arrValues.forEach( (strValue) => {
			result = result.concat(`${listType} ${strValue} \n`);
			
		})
		return result;
	}
	static toBold = (/** @type {string} */ strText) => {
		return `**${strText}**\n`;
	}
	static toItalic = (/** @type {string} */ strText) => {
		return `*${strText}*\n`;
	}
	static toRegular = (/** @type {string} */ strText) => {
		return `${strText} \n`;
	}
	static flip = (/** @type {string[]} */ arrValues) => {
		let result = '';
		arrValues.forEach(value => result = result.concat(value));
		return result;
	}
	/**
	 * 
	 * @param {DocsLine[]} arrDocsLine 
	 * @returns {string}
	 */
	static convert(arrDocsLine){
		let title = '';
		let text = '';
		let arrLines = arrDocsLine.map( (docsLine)=>{
			if(docsLine.hasTitle())
				title = MarkdownText.toItalic(docsLine.title) + ` ${Keyword.LONG_DASH} `;
			else
				title = '';
			text = MarkdownText.toRegular(docsLine.text);
			return title +  text;
		});
		return MarkdownText.toList(arrLines, false);
	}
}
class Keyword {
	static DelimType = {Default: 0, Small: 1, Long: 2}
	static LONG_DASH = '—';
	static arrInfoDelim = ['->', '-', '--'];
	static isGarbageChar =(/** @type {string} */ char) => {
		return (char == ' ') || (char == '\n') || (char == '\r');
	}
	static isDocsInfoDelim = (/** @type {string} */ strValue) => {
		let bResult = false;
		Keyword.arrInfoDelim.every( (strDelim) =>{
			if(strDelim.includes(strValue))
				bResult = true;
			return !bResult;
		})
		return bResult;
	}
	static getDocsDelim = (delimType = Keyword.DelimType.Default) => {
		if(delimType > Keyword.DelimType.Long)
			delimType = Keyword.DelimType.Default;
		return this.arrInfoDelim[delimType];
	}
}
class DocsLine {
	title = '';
	text = '';
	/**
	 * @param {string} [title]
	 * @param {string} [text]
	 */
	constructor (title, text){
		this.title = title;
		this.text = text;
	}
	isEmpty =  () => {
		if(this.text.length == 0)
			return true;
		return false;
	}
	hasTitle = () => {
		return this.title.length != 0;
	}
	append = (/**@type {string} */ strValue) => {
		this.text = this.text + ' ' + strValue;
	}
	static resultOf = (/** @type {string} */ rawLine)  =>{
		let offset = 0;
		let lineHeader = '';
		let stage = 0;
		let strDelim = Keyword.getDocsDelim();
		for(let i = 0; i < rawLine.length; i++){
			let symbol = rawLine.charAt(i);
			if (stage == 0){
				stage = 1;
				let delimOffset = rawLine.indexOf(strDelim);
				if(delimOffset != -1) {
					lineHeader = rawLine.substring(0, rawLine.lastIndexOf(' ', delimOffset));
					i = delimOffset + strDelim.length;
				}
				else 
				  i -= 1;
			}
			else 
				if(!Keyword.isGarbageChar(symbol)){
					offset = i;
					break;
				}
		}
		return new DocsLine(lineHeader, rawLine.substring(offset, rawLine.length));
	}
	
}
class Functional {
	static clearString = (/** @type {string} */ strDirty) => {
		strDirty = strDirty.trim();
		return strDirty;
	}
	static extractInfo = (/** @type {String[]} */ arrInfo) => {
		let arrResult = new Array();
		let lastLine = null;
		let currLine;
		arrInfo.forEach( (value) => {
			value = Functional.clearString(value);
			currLine = DocsLine.resultOf(value);
			if(lastLine != null && !currLine.hasTitle() && lastLine.hasTitle()){
				lastLine.append(currLine.text);
				currLine = lastLine;
			}
			else {
				lastLine = currLine;
				arrResult.push(currLine);
			}
		})
		if(arrResult.length == 0)
			arrResult = ['None'];
		return arrResult;
	}
	static exctractInputInfo = (/** @type {String[]} */ arrInfo) => {
		return Functional.extractInfo(arrInfo);
	}
	static extractOutputInfo = (/** @type {String[]} */arrInfo) => {
		return Functional.extractInfo(arrInfo);
	}
	static extractAuxInfo = (/** @type {String[]} */ arrInfo) => {
		return Functional.extractInfo(arrInfo);
	}
	static INPUT_LABEL 	= 'Input';
	static OUTPUT_LABEL = 'Output';
	static NOTE_LABEL	= 'Notes';
	static ASSUME_LABEL	= 'Assume';
	
	getStage = (/** @type {string} */ strLabel) => {
		switch(strLabel){
			case Functional.INPUT_LABEL:
				return DescriptionStage.InputPart;
			case Functional.OUTPUT_LABEL:
				return DescriptionStage.OutputPart;
			case Functional.ASSUME_LABEL:
				return DescriptionStage.AssumePart;
			case Functional.NOTE_LABEL:
				return DescriptionStage.NotesPart;
			default:
				return DescriptionStage.InfoPart;
		}
	}
	savePart = (/** @type {number} */ stage, /** @type {string[]} */ arrInfo) => {
		switch(stage){
			case DescriptionStage.InputPart:
				this.inputInfo = Functional.exctractInputInfo(arrInfo);
				break;
			case DescriptionStage.OutputPart:
				this.outputInfo = Functional.extractOutputInfo(arrInfo);
				break;
			case DescriptionStage.AssumePart:
			case DescriptionStage.NotesPart:
				this.auxInfo = Functional.extractAuxInfo(arrInfo);
				break;
			default:
				console.log('Unknown stage');
		}
	}
	/**
	 * @param {string} rawInfo
	 */
	constructor (rawInfo){
		let currStage = DescriptionStage.InfoPart;
		let relOffset = 0;
		let glOffset  = -1;
		let arrInfoPart = new Array();
		for(let i = 0; i < rawInfo.length; i++){
			switch(rawInfo.charAt(i)){
				case ';':
					if(currStage != DescriptionStage.InfoPart && relOffset != 0){
						arrInfoPart.push(rawInfo.substring(i - relOffset - glOffset, i));
					}
					relOffset = 0;
					glOffset = 0;
					break;
				case '\n':
				case '\r':
					glOffset += 1;
					break;
				case ':':
					let updStage = this.getStage(rawInfo.substring(i - relOffset, i));
					if(updStage != DescriptionStage.InfoPart){
						if(arrInfoPart.length != 0){
							this.savePart(currStage, arrInfoPart);				
							arrInfoPart = new Array();
						}
						currStage = updStage;
						relOffset = 0;
						glOffset = 0;
					}
					else {
						glOffset += 1;
					}
					break;
				default:
					relOffset += 1;
			}
		}	
		if(arrInfoPart.length != 0)
			this.savePart(currStage, arrInfoPart);	
	}

	/**
	 * @type {DocsLine[]}
	 */
	inputInfo = [];
	/**
	 * @type {DocsLine[]}
	 */
	outputInfo = [];
	/**
	 * @type {DocsLine[]}
	 */
	auxInfo = [];

	static PART_TITLES = [Functional.INPUT_LABEL, Functional.OUTPUT_LABEL, Functional.NOTE_LABEL];
	getHover = () => {
		let strValue = '';
		let arrTitle = Functional.PART_TITLES;
		[this.inputInfo, this.outputInfo, this.auxInfo].forEach( (arrLines, index) => {
			if(arrLines.length != 0){ 
				strValue += MarkdownText.toTitle(arrTitle[index]) + MarkdownText.convert(arrLines);
			}

		});
		let strMarkdown = new vscode.MarkdownString(strValue);

		return new vscode.Hover(strMarkdown);
	}
	getCompletion = () => {
		let arrTitle = Functional.PART_TITLES;
		let strResult = '';
		[this.inputInfo, this.outputInfo, this.auxInfo].forEach( (arrLines, index) =>{
			if(arrLines.length != 0){
				strResult += arrTitle[index] + '\n' + SimpleText.convert(arrLines);	
			}
		});


		return strResult;
	}
}
const DUMYY_MODULE_NAME = "@@Dummy_Module@@";
class FuncModule {
	/**
	 * @type {FuncHashNode[]}
	 */
	arrFunc = [];
	/**
	 * @type {string}
	 */
	selfName = '';
	/**
	 * @type {FuncModule}
	 */
	nextModule = null; //linked list of FuncModule
	type 
    /**
     * 
     * @param {string} moduleName 
     */
    constructor(moduleName) {
        this.selfName = moduleName;
    }
    /**
     * 
     * @param {FuncHashNode} funcNode 
     */
    add = (funcNode) =>{
        if(!this.contains(funcNode.nodeName))
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
			bResult = this.arrFunc.at(iFunc).nodeName == funcName;
			if(bResult)
				break;
		}
		return bResult;

	}

	/**
	 * 
	 * @param {string} funcName 
	 * @returns {FuncHashNode}
	 */
	get = (funcName) => {
		let iFunc = 0;
		let nodeResult = null;
		while(nodeResult == null && iFunc < this.arrFunc.length){
			nodeResult = this.arrFunc[iFunc].nodeName == funcName ? this.arrFunc[iFunc] : null;
			iFunc++;
		}
		return nodeResult;
	}

}
class HashNode {
	setSourceId = (/** @type {number} */ sourceId) => {
		this.sourceId = sourceId;
	}
	setHashKey = (/** @type {number} */ hashKey) =>{
		this.hashKey = hashKey;
	}
	nodeName = '';
	hasModule = true;
	/**
	 * @type {number}
	 */
	sourceId;
	/**
	 * @type {number}
	 */
    hashKey;
	static valueOf = (/** @type {string} */ moduleName, /** @type {string} */ nodeName, nodeType) =>{
		let result = new HashNode();
		result.nodeName = moduleName + nodeName;
		return result;
	}
	static arrayOf = (/** @type {string} */ moduleName, /** @type {string[]} */ nodeNames, nodeType) =>{
		let result = [];
		nodeNames.forEach(name => result.push(HashNode.valueOf(moduleName, name, nodeType)));
		return result;
	}
}
class FuncHashNode extends HashNode{
    /**
     * 
     * @param {string} funcName 
     * @param {Functional} funcInfo 
     */
    constructor(funcName, funcInfo) {
		super();
        this.hasModule = (funcName.indexOf('.') > - 1);
        if(!this.hasModule){
            funcName = DUMYY_MODULE_NAME + '.' + funcName;
        }
        let nameLength = funcName.charAt(funcName.length - 1) == ':' ? funcName.length - 1 : funcName.length;
        this.nodeName = funcName.substring(0, nameLength);
        this.funcInfo = funcInfo;
    }
	funcInfo;

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
     * @param {HashNode} hashNode 
     */
    add = (hashNode) => {
		let moduleHead;
        let arrString = hashNode.nodeName.split('.', 2); //module and funcName
        let moduleName = arrString[0];
        hashNode.nodeName = arrString[1];
        hashNode.hashKey = this.getHashCode(moduleName);
		moduleHead = this.addModule(moduleName, hashNode.hasModule);
        moduleHead.add(hashNode);
    }
	addAll = (/** @type {HashNode[]} */ nodes) => {
		nodes.forEach(node => this.add(node));
	}
	//add module or return existing
	addModule = (/** @type {string} */ moduleName, isIndexed = true) => {
		let hashKey = this.getHashCode(moduleName);
		let moduleHead = this.table[hashKey];
		let hasNext = moduleHead != null && moduleHead.nextModule != null;
		let wasAdded = false;
		while(hasNext && moduleHead.selfName != moduleHead){
			moduleHead = moduleHead.nextModule;
			hasNext = moduleHead.nextModule != null;
		}
		if(moduleHead == null){
			moduleHead = (this.table[hashKey] = new FuncModule(moduleName));
			wasAdded = true;
		}
		if(!wasAdded && moduleHead.selfName != moduleName){
			moduleHead = (moduleHead.nextModule = new FuncModule(moduleName));
			wasAdded = true;
		}
		if(isIndexed && wasAdded)
			this.saveModule(moduleHead);
		return moduleHead;
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
	clear = () => {
		let oldCapacity = this.table.length;
		this.table = new Array(oldCapacity);
		this.moduleIndex = new Array(oldCapacity);
	}
}


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


const hashTable = new HashIndex(MAX_FUNC_MODULE_CNT);
const arrFiles = new Array(INDEX_FILE_CNT);
let lastFileIndex = -1;

//Notes: separate user input onto two parts:
	//before dote: <Module>
	//after doate: <Method>
class UserInput {
	/**
	 * @type {string[]}
	 */
	static arrString;
	static munchExtract = (document, cursorPos) => {
		let strBuffer = document.lineAt(cursorPos.line).text;
		let iStart = cursorPos.character;
		if(strBuffer.charAt(iStart) != ' '){
			iStart += 1;
			while(iStart < strBuffer.length && strBuffer.charAt(iStart) != ' ')
				iStart += 1;
			UserInput.extract(document, new vscode.Position(cursorPos.line, iStart));
		}
		else {
			UserInput.arrString = ['', ''];
		}
	}
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
class HoverProvider {
	provideHover(document, position, token){
		UserInput.munchExtract(document, position);
		let moduleName = UserInput.extractModule();
		let funcName = UserInput.extractMethod();
		if(moduleName == null)
			moduleName = DUMYY_MODULE_NAME;
		let funcNode = hashTable.getModule(moduleName).get(funcName);
		if(funcNode == null)
			return null;
		return funcNode.funcInfo.getHover();
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
	getFuncItems = (/** @type {string} */ moduleName, /** @type {string} */ funcName) => {
		let moduleHead = hashTable.getModule(moduleName);
		let arrItems = [];
		if(moduleHead == null)
			return null;

		moduleHead.arrFunc.forEach( (funcNode) => {
			if(funcNode.nodeName.includes(funcName) ) { //skip module name
				let item = new vscode.CompletionItem(funcNode.nodeName, vscode.CompletionItemKind.Function);
				item.documentation = funcNode.funcInfo.getCompletion();
				arrItems.push(item);
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
class HashNodeType {
	static Function = Symbol('Function');
	static Field = Symbol('Field');
}
class HashModuleType {
	static Class = Symbol('Class');
	static Struct = Symbol('Struct');
	static convertToNode = (/**@type {HashModuleType}*/type) => {
		switch(type){
			case this.Class:
				return HashNodeType.Function;
			case this.Struct:
				return HashNodeType.Field;
		}
	}
}
class DocsBlockType {
	static Functional = Symbol('Functional');
	static Struct = Symbol('Struct');
	static convertToModule = (/**@type {DocsBlockType}*/type) => {
		switch(type){
			case this.Functional:
				return HashModuleType.Class;
			case this.Struct:
				return HashModuleType.Struct;
		}
	}
}
class DocsInfo {
	type = new DocsBlockType();
	data = [];
	/**
	 * @param {DocsBlockType} type
	 * @param {any[]} data
	 */
	constructor(type, data){
		this.type = type;
		this.data = data;
	}
}
class DocsStructInfo extends DocsInfo {
	constructor(/**@type {string[]} */arrString){
		super(DocsBlockType.Struct, arrString); //first element of arrString is Struct Label selfly
	}
}
class DocsBlock {
	type = new DocsBlockType();
	block;
	nextLine;
	auxInfo = null;
	constructor(/**@type {string} */block, /**@type {number} */nextLine){
		this.nextLine = nextLine;
		this.block = block;
		this.type = DocsBlockType.Functional;
	}
	static valueOf = (/** @type {number} */ nextLine, /** @type {DocsInfo} */ auxInfo) => {
		let object = new DocsBlock('', nextLine);
		object.type = auxInfo.type;
		object.auxInfo = auxInfo.data;
		return object;
	}
}
const STR_DOCS_START = ';Input:';
const STR_DECLARE_START = ';@Declare';
const hasExtSyntax = (strLine) => {
	return strLine.includes(STR_DECLARE_START);
}
const getExtBlock = (/** @type {vscode.TextDocument} */ fHandle, /** @type {number} */ nLine, /** @type {number} */ limitLine) => {
	let result = null;
	let tempArray = [];
	let buffString = fHandle.lineAt(nLine + 1).text;
	let nextClosed = true;
	let auxBuffer = [''];
	nLine += 2;
	if(!buffString.includes('struct'))
		return result;
	auxBuffer = buffString.match(/[a-zA-Z]+/g);
	if(auxBuffer.length == 1)
		return result;
	tempArray.push(auxBuffer[1].trim());
	while(nLine < limitLine && nextClosed){
		buffString = fHandle.lineAt(nLine++).text;
		auxBuffer = buffString.match('\.[a-zA-Z]+ ');
		if(auxBuffer != null)
			tempArray.push(auxBuffer[0].trim());
		nextClosed = buffString.match('[ ]*\}') == null;
	}
	if(tempArray.length > 0)
		result = DocsBlock.valueOf(nLine, new DocsStructInfo(tempArray));
	return result;
}
const getDocsBlock = (/** @type {vscode.TextDocument} */ fHandle, /** @type {number} */ nLine, /** @type {number} */ limitLine) => {
	let startLine = nLine;
	let buffString = fHandle.lineAt(nLine).text;
	if(buffString.indexOf(STR_DOCS_START) != 0)
		return hasExtSyntax(buffString) ? getExtBlock(
					fHandle, nLine, limitLine) : null;
	nLine += 1;
	while( (nLine < limitLine) && fHandle.lineAt(nLine).text.indexOf(';') != -1)
		nLine++;
	buffString = fHandle.getText(
		new vscode.Range(
			new vscode.Position(startLine, 0),
			new vscode.Position(nLine - 1, 1) 
		)
	)
	return new DocsBlock(buffString, nLine);
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
const addToIndex = (/** @type {vscode.TextDocument} */ fHandle) => {
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
		if(buffDocs.type == DocsBlockType.Functional){
			let funcName = getFirstName(fHandle, currLine++);
			if(funcName.charAt(0) != '.'){ //if not internal label
				let funcNode = new FuncHashNode(funcName, 
												new Functional(buffDocs.block));
				funcNode.setSourceId(getLastSourceIndex());
				hashTable.add(funcNode);
			}
		}
		else {
			let moduleName = buffDocs.auxInfo[0];
			let moduleType = DocsBlockType.convertToModule(buffDocs.type)
			hashTable.addAll(
				HashNode.arrayOf(moduleName, 
								buffDocs.auxInfo.slice(1, buffDocs.auxInfo.length),
								moduleType
								)
			)
		}
			
		
			

	}


}
class Message {
	static CompileError = Symbol('CompileError');
	static IndexError = Symbol('IndexError');
}
class MessageSender {
	static errorMessage = '';
	static send = (/** @type {string} */strMessage) => {
		vscode.window.showInformationMessage(strMessage);
	}
}
class IndexMemory {
	arrExtType = ["asm", "inc", "fasm"];	
	maxFileCnt = INDEX_FILE_CNT;
	/**
	 * @type {string[]}
	 */
	ignoreFiles = [];
	errorHandle = null;
	indexHandle = null; //function that invoked by index construction (vscode.TextDocument)
	addSourceExtension = (/** @type {string} */ strExtType) => {
		this.arrExtType.push(strExtType);
	}
	getSourceExtension = () => {
		return this.arrExtType;
	}
	getFileCnt = () => {
		return this.maxFileCnt;
	}
	init = () => {
		let filesPromise = vscode.workspace.findFiles(
			IndexMemory.convertTemplate(this.getSourceExtension()),
			IndexMemory.convertTemplate(this.getIgnoreFiles(), ''),
			this.getFileCnt());
		
		filesPromise.then( (arrFiles) => {
			if(arrFiles.length == 0)
				this.errorHandle();
			arrFiles.forEach((/** @type {vscode.Uri} */ fileUri) => {
				let fHandle = vscode.workspace.openTextDocument(fileUri);
				fHandle.then((file) => this.indexHandle(file));
			});
		}, this.errorHandle);
	}
	//or by ignore file, or by array
	setIgnoreFiles = (/** @type {string[]}*/ sourceFiles = []) => {
		this.ignoreFiles = sourceFiles;
		if(sourceFiles.length != 0){
			return new Promise((resolve) => {
				resolve();
			})
		}

		let filePromise = vscode.workspace.findFiles(IndexMemory.getIgnoreSourceName(), undefined, 1);
		let promiseResult = new Promise((resolve, reject) => {
			filePromise.then( (arrFiles) => {
					let fHandle = vscode.workspace.openTextDocument(arrFiles[0]);
					fHandle.then( (document) => {
						this.ignoreFiles = this.extractFileNames(document);
						resolve();
					}, reject)
			});		
		})
		return promiseResult;
	}
	getIgnoreFiles = () => {
		return this.ignoreFiles;
	}
	extractFileNames = (/** @type {vscode.TextDocument} */ fHandle) => {
		let lineCnt = fHandle.lineCount;
		let iLine = 0;
		let buffString = '';
		let arrResult = [];
		while(iLine < lineCnt) {
			buffString = fHandle.lineAt(iLine).text;
			buffString.trim();
			if(buffString.length != 0)
				arrResult.push(buffString);
			iLine += 1;
		}
		return arrResult;
	}
	static IGNORE_FILE_NAME = ".fasmignore";
	static convertTemplate = (/** @type {string[]} */ arrExts, /** @type {string} */ strHeader = "**/*.") => {
		if(arrExts.length == 0)
			return (strHeader.length == 0) ? null : strHeader + "*";
		
		let result = strHeader + '{';
		arrExts.forEach( extValue => {
			result = result + extValue + ','
		})
		result = result.substring(0, result.length - 1) + '}';
		return result;
	}
	static getIgnoreSourceName = () => {
		return IndexMemory.IGNORE_FILE_NAME;
	}
}
const indexMemory = new IndexMemory();
const initIndex = () => {
	hashTable.clear(); //todo: replace with adaptive changing
	indexMemory.setIgnoreFiles().then(indexMemory.init, indexMemory.errorHandle);
	MessageSender.send("Indexation completed")
};
const compileProject = () => {
	if(osMode == OperationSystem.Unknown){
		vscode.window.showErrorMessage("Unknown operation system");
		return;
	}
	let strCommand;
	let terminal;
	if(vscode.window.terminals.length == 0)
		terminal = vscode.window.createTerminal(`fasm terminal`);
	else
		terminal = vscode.window.terminals.at(0);
	switch(osMode){
		case OperationSystem.Win:
			strCommand = `start ${CompillerPath}`;
			break;
		case OperationSystem.Linux:
			strCommand = `${CompillerPath}`
			break;
	}
	terminal.sendText(strCommand);
	
}
var osMode = OperationSystem.Unknown;
const initGlobals = () => {

	WorkDirectoryPath = vscode.workspace.workspaceFolders[0].uri.path;
	CompillerPath = vscode.workspace.getConfiguration(CONFIG_HEADER).get('compiler');
	vscode.workspace.getConfiguration(CONFIG_HEADER).get("extensions").forEach( (/** @type {string} */ extValue) => {
		indexMemory.addSourceExtension(extValue);
	});
	indexMemory.errorHandle = () => {
		MessageSender.send('Error during index construction');
	}
	indexMemory.indexHandle = (/** @type {vscode.TextDocument}*/ document) => {
		saveSourceFile(document.fileName);
		addToIndex(document);
	}
	switch(system.type()){
		case "Windows_NT":
			osMode = OperationSystem.Win;
			break;
		case "Linux":
			osMode = OperationSystem.Linux;
			break;
	}
}



/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	initGlobals();
	let disposable = vscode.commands.registerCommand('fasm.initIndex', initIndex);	
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('fasm.compile',compileProject);
	context.subscriptions.push(disposable);

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            LANG_NAME, new CompletionItemProvider(), '.'));
	vscode.languages.registerHoverProvider(LANG_NAME, new HoverProvider());
	initIndex();
}




function deactivate() {}

module.exports = {
	activate,
	deactivate
}
