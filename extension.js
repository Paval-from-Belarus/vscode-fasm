const system = require('node:os');
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
        arrDocsLine.forEach((docLine) => {
            if (docLine.hasTitle())
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
        arrValues.forEach((strValue) => {
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
    static convert(arrDocsLine) {
        let title = '';
        let text = '';
        let arrLines = arrDocsLine.map((docsLine) => {
            if (docsLine.hasTitle())
                title = MarkdownText.toItalic(docsLine.title) + ` ${Keyword.LONG_DASH} `;
            else
                title = '';
            text = MarkdownText.toRegular(docsLine.text);
            return title + text;
        });
        return MarkdownText.toList(arrLines, false);
    }
}
class Keyword {
    static DelimType = { Default: 0, Small: 1, Long: 2 }
    static LONG_DASH = '—';
    static arrInfoDelim = ['->', '-', '--'];
    static isGarbageChar = (/** @type {string} */ char) => {
        return (char == ' ') || (char == '\n') || (char == '\r');
    }
    static isDocsInfoDelim = (/** @type {string} */ strValue) => {
        let bResult = false;
        Keyword.arrInfoDelim.every((strDelim) => {
            if (strDelim.includes(strValue))
                bResult = true;
            return !bResult;
        })
        return bResult;
    }
    static getDocsDelim = (delimType = Keyword.DelimType.Default) => {
        if (delimType > Keyword.DelimType.Long)
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
    constructor(title, text) {
        this.title = title;
        this.text = text;
    }
    isEmpty = () => {
        if (this.text.length == 0)
            return true;
        return false;
    }
    hasTitle = () => {
        return this.title.length != 0;
    }
    append = (/**@type {string} */ strValue) => {
        this.text = this.text + ' ' + strValue;
    }
    static resultOf = (/** @type {string} */ rawLine) => {
        let offset = 0;
        let lineHeader = '';
        let stage = 0;
        let strDelim = Keyword.getDocsDelim();
        for (let i = 0; i < rawLine.length; i++) {
            let symbol = rawLine.charAt(i);
            if (stage == 0) {
                stage = 1;
                let delimOffset = rawLine.indexOf(strDelim);
                if (delimOffset != -1) {
                    lineHeader = rawLine.substring(0, rawLine.lastIndexOf(' ', delimOffset));
                    i = delimOffset + strDelim.length;
                }
                else
                    i -= 1;
            }
            else
                if (!Keyword.isGarbageChar(symbol)) {
                    offset = i;
                    break;
                }
        }
        return new DocsLine(lineHeader, rawLine.substring(offset, rawLine.length));
    }

}
const extractFileName = (/** @type {string} */sFullPath) => {
    let result = sFullPath.substring(WorkDirectoryPath.length + 1);
    return result;
}
class NodeInfo {
    getHover = () => {
        return new vscode.Hover('');
    }
    getCompletion = () => {
        return this.sourceFile;
    }
    sourceFile = NodeInfo.originFileName;
    static originFileName = '';
    static setGlobalOrigin = (/** @type {string} */ sFullPath) => {
        NodeInfo.originFileName = extractFileName(sFullPath);
    }
}
class Functional extends NodeInfo {
    static clearString = (/** @type {string} */ strDirty) => {
        strDirty = strDirty.trim();
        return strDirty;
    }
    static extractInfo = (/** @type {String[]} */ arrInfo) => {
        let arrResult = new Array();
        let lastLine = null;
        let currLine;
        arrInfo.forEach((value) => {
            value = Functional.clearString(value);
            currLine = DocsLine.resultOf(value);
            if (lastLine != null && !currLine.hasTitle() && lastLine.hasTitle()) {
                lastLine.append(currLine.text);
                currLine = lastLine;
            }
            else {
                if (currLine.text.length != 0) {
                    lastLine = currLine;
                    arrResult.push(currLine);
                }
            }
        })
        if (arrResult.length == 0)
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
    static INPUT_LABEL = 'Input';
    static OUTPUT_LABEL = 'Output';
    static NOTE_LABEL = 'Notes';
    static ASSUME_LABEL = 'Assume';

    getStage = (/** @type {string} */ strLabel) => {
        switch (strLabel) {
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
        switch (stage) {
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
    constructor(rawInfo) {
        super();
        let currStage = DescriptionStage.InfoPart;
        let relOffset = 0;
        let glOffset = -1;
        let arrInfoPart = new Array();
        for (let i = 0; i < rawInfo.length; i++) {
            switch (rawInfo.charAt(i)) {
                case ';':
                    if (currStage != DescriptionStage.InfoPart && relOffset != 0) {
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
                    if (updStage != DescriptionStage.InfoPart) {
                        if (arrInfoPart.length != 0) {
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
        if (arrInfoPart.length != 0)
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
        [this.inputInfo, this.outputInfo, this.auxInfo].forEach((arrLines, index) => {
            if (arrLines.length != 0) {
                strValue += MarkdownText.toTitle(arrTitle[index]) + MarkdownText.convert(arrLines);
            }

        });
        let strMarkdown = new vscode.MarkdownString(strValue);

        return new vscode.Hover(strMarkdown);
    }
    getCompletion = () => {
        let arrTitle = Functional.PART_TITLES;
        let strResult = '';
        [this.inputInfo, this.outputInfo, this.auxInfo].forEach((arrLines, index) => {
            if (arrLines.length != 0) {
                strResult += arrTitle[index] + '\n' + SimpleText.convert(arrLines);
            }
        });
        strResult += '\n' + this.sourceFile;

        return strResult;
    }
}
const DUMYY_MODULE_NAME = "@@Dummy_Module@@";
class FuncModule {
    /**
     * @type {HashNode[]}
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
    type = new HashModuleType();
    /**
     * 
     * @param {string} moduleName 
     */
    constructor(moduleName) {
        this.selfName = moduleName;
    }
    /**
     * 
     * @param {HashNode} funcNode 
     */
    add = (funcNode) => {
        if (!this.contains(funcNode.nodeName))
            this.arrFunc.push(funcNode);
    }
    /**
     * 
     * @param {string} funcName 
     * @returns boolean;
     */
    contains = (funcName) => {
        let bResult = false;
        for (let iFunc = 0; iFunc < this.arrFunc.length; iFunc++) {
            bResult = this.arrFunc.at(iFunc).nodeName == funcName;
            if (bResult)
                break;
        }
        return bResult;

    }

    /**
     * 
     * @param {string} funcName 
     * @returns {HashNode}
     */
    get = (funcName) => {
        let iFunc = 0;
        let nodeResult = null;
        while (nodeResult == null && iFunc < this.arrFunc.length) {
            nodeResult = this.arrFunc[iFunc].nodeName == funcName ? this.arrFunc[iFunc] : null;
            iFunc++;
        }
        return nodeResult;
    }
    setModuleType = (/** @type {HashModuleType} */ type) => {
        this.type = type;
    }

}
class HashNode {
    setSourceId = (/** @type {number} */ sourceId) => {
        this.sourceId = sourceId;
    }
    setHashKey = (/** @type {number} */ hashKey) => {
        this.hashKey = hashKey;
    }

    nodeInfo = new NodeInfo();
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

    static valueOf = (/** @type {string} */ moduleName, /** @type {string} */ nodeName) => {
        let result = new HashNode();
        result.nodeName = moduleName + '.' + nodeName;
        return result;
    }
    /**@returns {HashNode[]} */
    static arrayOf = (/** @type {string} */ moduleName, /** @type {string[]} */ nodeNames) => {
        let result = [];
        nodeNames.forEach(name => result.push(HashNode.valueOf(moduleName, name)));
        return result;
    }
}
class FuncHashNode extends HashNode {
    /**
     * 
     * @param {string} funcName 
     * @param {Functional} funcInfo 
     */
    constructor(funcName, funcInfo) {
        super();
        this.hasModule = (funcName.indexOf('.') > - 1);
        if (!this.hasModule) {
            funcName = DUMYY_MODULE_NAME + '.' + funcName;
        }
        let nameLength = funcName.charAt(funcName.length - 1) == ':' ? funcName.length - 1 : funcName.length;
        this.nodeName = funcName.substring(0, nameLength);
        this.nodeInfo = funcInfo;
    }
}

class HashIndex {
    /**
     * 
     * @param {number} init_capacity 
     */
    constructor(init_capacity) {
        this.table = new Array(init_capacity)
        this.moduleIndex = [];
    }
    table;
    moduleIndex;

    /**
     * 
     * @param {FuncModule} moduleHead 
     */
    saveModule = (moduleHead) => {
        if (!this.moduleIndex.includes(moduleHead))
            this.moduleIndex.push(moduleHead);
    }
    /**
     * 
     * @param {HashNode} hashNode 
     */
    add = (hashNode, /** @type {HashModuleType} */ moduleType) => {
        let moduleHead;
        let arrString = hashNode.nodeName.split('.', 2); //module and funcName
        let moduleName = arrString[0];
        hashNode.nodeName = arrString[1];
        hashNode.hashKey = this.getHashCode(moduleName);
        moduleHead = this.addModule(moduleName, hashNode.hasModule);
        moduleHead.setModuleType(moduleType);
        moduleHead.add(hashNode);
    }
    addAll = (/** @type {HashNode[]} */ nodes, /** @type {HashModuleType} */ moduleType) => {
        nodes.forEach(node => this.add(node, moduleType));
    }
    //add module or return existing
    addModule = (/** @type {string} */ moduleName, isIndexed = true) => {
        let hashKey = this.getHashCode(moduleName);
        let moduleHead = this.table[hashKey];
        let hasNext = moduleHead != null && moduleHead.nextModule != null;
        let wasAdded = false;
        while (hasNext && moduleHead.selfName != moduleHead) {
            moduleHead = moduleHead.nextModule;
            hasNext = moduleHead.nextModule != null;
        }
        if (moduleHead == null) {
            moduleHead = (this.table[hashKey] = new FuncModule(moduleName));
            wasAdded = true;
        }
        if (!wasAdded && moduleHead.selfName != moduleName) {
            moduleHead = (moduleHead.nextModule = new FuncModule(moduleName));
            wasAdded = true;
        }
        if (isIndexed && wasAdded)
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
        for (let i = 0; i < moduleName.length; i++)
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
        if (moduleHead != null) {
            while (moduleHead.nextModule != null && moduleHead.selfName != moduleName) {
                moduleHead = moduleHead.nextModule;
            }
            if (moduleHead.selfName != moduleName)
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
        if (probeHead == null) {
            this.moduleIndex.forEach((moduleHead) => {
                if (moduleHead.selfName.includes(moduleName))
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
        this.moduleIndex = [];
    }
}

/**@type {string} */
var CompillerPath;
/**@type {string} */
var WorkDirectoryPath;

const SEARCH_EXT = ['.fasm', '.asm', '.inc'];
const IGNORE_FILES = [];
const hashTable = new HashIndex(MAX_FUNC_MODULE_CNT);

class FileLink {
    /**
     * @param {number} [id]
     */
    constructor(id) {
        this.id = id;
    }
    /**
     * @type {number}
     */
    id;
    /**
     * @type {string[]}
     */
    links = [];
    /**@type {number[]}*/mapLinks = [];
    add = (/** @type {string} */ link) => {
        this.links.push(link);
    }
    /**@returns {string[]|number[]} */
    get = () => {
        if (this.mapLinks.length == 0)
            return this.links
        return this.mapLinks;
    }
    /**@returns {boolean} */
    contains = (/**@type {number | string}*/ fileId) => {
        return true;
        // if (typeof fileId == 'number') {
        //     let index = new Number(fileId).valueOf();
        //     return this.mapLinks.includes(index);
        // }
        // let fileName = new String(fileId).valueOf();
        // return this.links.includes(fileName);
    }

}
class FileIndex {
    static LINK_KEYWORDS_REGEXP = "insert | include"; //keyword that's using for link files between each other
	/** @type {string[]}*/ files = [];
	/**@type {FileLink[]} */ fileLinks = [];

    /**@type {number[]}*/links;
    static normalizeName = (/** @type {string} */ fullName) => {
        if (!fullName.includes(WorkDirectoryPath))
            return fullName.toUpperCase().replace(/\\/g, "/");
        let selfIndex = WorkDirectoryPath.length;
        let fileName = fullName.substring(selfIndex + 1, fullName.length).trim();
        return fileName.toUpperCase().replace(/\\/g, "/");
    }
    add = (/**@type {string}*/fullName) => {
        let fileName = FileIndex.normalizeName(fullName);
        console.log(fullName);
        this.files.push(fileName);
    }
    getCurrentIndex = () => {
        if (this.files.length == 0) {
            console.log("INVALID_SOURCE_FILE");
        }
        return (this.files.length - 1);//return index of last file
    }
    getFileIndex = (/** @type {string} */ fullName) => {
        let fileName = FileIndex.normalizeName(fullName);
        return this.files.indexOf(fileName);
    }
    //save link for current file id 
    //specified by this document
    saveLinks = (/** @type {vscode.TextDocument} */ document) => {
        let sourceIndex = this.getFileIndex(document.fileName);
        let wholeText = document.getText();

        let regExpr = new RegExp(` *${FileIndex.LINK_KEYWORDS_REGEXP} +('|\")(.+)('|\") *\n?`, 'g');
        const fileLink = new FileLink(sourceIndex);
        for (const link of wholeText.matchAll(regExpr)) {
            if (link.length >= 2) {
                fileLink.add(link[2]);
            }
        }
        this.fileLinks.push(fileLink);
    }
    /**@returns {FileLink} */
    getLinks = (/**@type {number}*/ fileId) => {
        if (fileId >= this.fileLinks.length)
            return null;
        return this.fileLinks[fileId];
    }
    /**@return {boolean} */
    normalizeLinks = () => {
        let response = true;
        for (const link of this.fileLinks) {
            let mapLinks = [];
            for (const fileName of link.links) {
                if (this.contains(fileName)) {
                    mapLinks.push(this.getFileIndex(fileName));
                }
                else
                    response = false;
            }
            link.mapLinks = mapLinks;
        }
        return response;
    }
    contains = (/**@type {string}*/fileName) => {
        let normalized = FileIndex.normalizeName(fileName);
        let result = this.files.includes(normalized);
        return result;
    }
}
let lastFileIndex = -1;

//Notes: separate user input onto two parts:
//before dote: <Module>
//after doate: <Method>
class UserInput {
    /**
     * @type {string[]}
     */
    static arrString;
    static munchExtract = (/** @type {{ lineAt: (arg0: any) => { (): any; new (): any; text: any; }; }} */ document, /** @type {{ line: number; character: any; }} */ cursorPos) => {
        let strBuffer = document.lineAt(cursorPos.line).text;
        let iStart = cursorPos.character;
        if (strBuffer.charAt(iStart) != ' ') {
            iStart += 1;
            while (iStart < strBuffer.length && strBuffer.charAt(iStart) != ' ')
                iStart += 1;
            UserInput.extract(document, new vscode.Position(cursorPos.line, iStart));
        }
        else {
            UserInput.arrString = ['', ''];
        }
    }
    static extract = (/** @type {{ lineAt: (arg0: any) => { (): any; new (): any; text: any; }; }} */ document, /** @type {vscode.Position} */ cursorPos) => {
        let strBuffer = document.lineAt(cursorPos.line).text;
        let iEnd = cursorPos.character - 1;
        let iStart = iEnd;
        while (iStart > 0 && strBuffer.charAt(iStart - 1) != ' ')
            iStart--;

        this.arrString = strBuffer.substring(iStart, iEnd + 1).split('.', 2);
    }
    //it can be only part of real module name
    static extractModule = () => {
        let moduleName;
        if (this.arrString.length == 1 || this.arrString[0].length == 0)
            moduleName == null;
        else
            moduleName = this.arrString[0];
        //it's not module because module always starts with 
        //upperCase letter
        return moduleName;
    }
    static extractMethod = () => {
        let lblName;
        if (this.arrString.length == 1) {
            lblName = this.arrString[0];
        }
        else {
            lblName = this.arrString[1];
        }
        return lblName;
    }
}
class HoverProvider {
    /**
     * @param {any} document
     * @param {any} position
     * @param {any} token
     */
    provideHover(document, position, token) {
        UserInput.munchExtract(document, position);
        let moduleName = UserInput.extractModule();
        let funcName = UserInput.extractMethod();
        if (moduleName == null)
            moduleName = DUMYY_MODULE_NAME;
        let funcNode = hashTable.getModule(moduleName).get(funcName);
        if (funcNode == null)
            return null;
        return funcNode.nodeInfo.getHover();
    }
}
class HashNodeFilter {
    static DocLinks = Symbol("Document Links");
}
const filterHashItems = (/**@type {number}*/ docId, /**@type {HashNode[]}*/hashItems, /**@type {HashNodeFilter}*/filterType) => {
    if (filterType != HashNodeFilter.DocLinks)
        return [];
    const fileLinks = fileIndex.getLinks(docId);
    if(fileLinks == null)
        return [];
    let filtered = hashItems
            .filter(item => fileLinks.contains(item.sourceId));
    return filtered;
}
class SearchGroup {
    found;
    token;
    /**
     * @param {boolean} isFound
     * @param {object} token
     */
    constructor(isFound, token) {
        this.found = isFound;
        this.token = token;
    }
}
class CompletionItemProvider {
    static getModuleKind = (/** @type {HashModuleType} */ moduleType) => {
        switch (moduleType) {
            case HashModuleType.Class:
                return vscode.CompletionItemKind.Class;
            case HashModuleType.Struct:
                return vscode.CompletionItemKind.Struct;
            case HashModuleType.Enum:
                return vscode.CompletionItemKind.Enum;
            case HashModuleType.Interface:
                return vscode.CompletionItemKind.Interface;
        }
    }
    static getNodeKind = (/** @type {HashNodeType} */ nodeType) => {
        switch (nodeType) {
            case HashNodeType.Function:
                return vscode.CompletionItemKind.Method;
            case HashNodeType.Field:
                return vscode.CompletionItemKind.Field;
            case HashNodeType.EnumMember:
                return vscode.CompletionItemKind.EnumMember;
            case HashNodeType.Property:
                return vscode.CompletionItemKind.Property;
        }
    }
    /** @type {number}*/ docId;
    setCurrentDocument = (/** @type {any} */ document) => {
        this.docId = getSourceId(document);
    }
    getCurrentDocId = () => this.docId;
    getModuleItems = (/**@type {string}*/ moduleName) => {
        let arrModules = hashTable.getModules(moduleName);

        return arrModules.map(module => {
            let itemKind = CompletionItemProvider.getModuleKind(module.type);
            return new vscode.CompletionItem(module.selfName, itemKind);
        });
    }
    getFuncItems = (/** @type {string} */ moduleName, /** @type {string} */ funcName) => {
        let moduleHead = hashTable.getModule(moduleName);
        let itemKind;
        if (moduleHead == null)
            return null;
        itemKind = CompletionItemProvider.getNodeKind(
            HashModuleType.convertToNode(moduleHead.type)
        );
        return filterHashItems(this.getCurrentDocId(), moduleHead.arrFunc, HashNodeFilter.DocLinks)
            .filter(node => node.nodeName.includes(funcName))
            .map(node => {
                let item = new vscode.CompletionItem(node.nodeName, itemKind);
                item.documentation = node.nodeInfo.getCompletion();
                return item;
            })
    }
    /**
     * @type {string[]}
     */
    static FASM_KEYWORDS = ["Declare", "Description"]

    /**
     * @param {string} piece 
     * @returns {string[]}
     */
    findKeywords = (piece) => {
        let keywords = [];
        CompletionItemProvider.FASM_KEYWORDS
            .forEach( (value) => {
                if (value.includes(piece)) {
                    keywords.push(value);
                }
            })
            return keywords;
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
        if (funcName != undefined) {
            arrItems = this.getFuncItems(moduleName, funcName); 
        } else {
            arrItems = this.getModuleItems(moduleName);
        }
        return arrItems;
    }
    /**
     * @param {string[]} keywords
     */
    static wrapeKeywords(keywords){
        return keywords.map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword))
    }
    /**
     * @param {any} document
     * @param {any} position
     * @param {any} token
     */
    provideCompletionItems(
        document, position, token) {
        let moduleName;
        let funcName;
        let arrItems = new Array();
        let tempItems;
        this.setCurrentDocument(document);
        UserInput.extract(document, position);
        moduleName = UserInput.extractModule();
        funcName = UserInput.extractMethod();
        if (moduleName == null) {
            let matchers = funcName.match(/;@(.)+/);
            if (matchers != null) {
                let keywords = this.findKeywords(matchers.at(1));
                if (keywords != null) {
                    return CompletionItemProvider.wrapeKeywords(keywords);
                }
            }
        }
        if (moduleName == null) {
            tempItems = this.getItems(funcName, undefined);
            if (tempItems != null) {
                tempItems.forEach((moduleItem) => {
                    arrItems.push(moduleItem)
                })
            }
            moduleName = DUMYY_MODULE_NAME;
        }
        tempItems = this.getItems(moduleName, funcName);
        if (tempItems != null)
            tempItems.forEach(item => arrItems.push(item));
        return arrItems;
    }
}
class HashNodeType {
    static Function = Symbol('Function');
    static Field = Symbol('Field');
    static EnumMember = Symbol("EnumMember");
    static Property = Symbol("Property");
}
class HashModuleType {
    static Class = Symbol('Class');
    static Struct = Symbol('Struct');
    static Enum = Symbol("Enum");
    static Interface = Symbol("Interface");
    static convertToNode = (/**@type {HashModuleType}*/type) => {
        switch (type) {
            case this.Class:
                return HashNodeType.Function;
            case this.Struct:
                return HashNodeType.Field;
            case this.Enum:
                return HashNodeType.EnumMember;
            case this.Interface:
                return HashNodeType.Property;
        }
    }
}
class DocsBlockType {
    static Functional = Symbol('Functional');
    static Struct = Symbol('Struct');
    static Enum = Symbol('Enum');
    static Macro = Symbol('Macro');
    static convertToModule = (/**@type {DocsBlockType}*/type) => {
        switch (type) {
            case this.Functional:
                return HashModuleType.Class;
            case this.Struct:
                return HashModuleType.Struct;
            case this.Enum:
                return HashModuleType.Enum;
            case this.Macro:
                return HashModuleType.Interface;
        }
    }
}
class DocsInfo {
    type = new DocsBlockType();
    /**
     * @param {DocsBlockType} type
     */
    constructor(type) {
        this.type = type;
    }
}
class DocsStructInfo extends DocsInfo {
    /**@type {string[]} */
    fields;
    /**@type {string} */
    name;
    constructor(/**@type {string} */ name, /**@type {string[]} */ fields) {
        super(DocsBlockType.Struct);
        this.fields = fields;
        this.name = name;
    }
}
class DocsEnumInfo extends DocsInfo {
    /**@type {string[]} */
    values;
    /**@type {string} */
    name;
    constructor(/**@type {string} */ name, /**@type {string[]} */ values) {
        super(DocsBlockType.Enum);
        this.name = name;
        this.values = values;
    }
}
class DocsMacroInfo extends DocsInfo {
    name;
    binding;
    params;
    /**
     * @param {string} name
     * @param {string} binding
     * @param {string[]} params
     */
    constructor(name, binding, ...params) {
        super(DocsBlockType.Macro);
        this.name = name;
        this.binding = binding;
        this.params = params;
    }

}
class DocsBlock {
    type = new DocsBlockType();
    /**@type {string | DocsInfo} */
    block;
    nextLine;
    constructor(/**@type {string} */block, /**@type {number} */nextLine) {
        this.nextLine = nextLine;
        this.block = block;
        this.type = DocsBlockType.Functional;
    }
    static valueOf = (/** @type {number} */ nextLine, /** @type {DocsInfo} */ auxInfo) => {
        let instance = new DocsBlock('', nextLine);
        instance.type = auxInfo.type;
        instance.block = auxInfo;
        return instance;
    }
}
const STR_DOCS_START = ';Input:';
const STR_DECLARE_START = ';@Declare';
const hasExtSyntax = (/** @type {string | string[]} */ strLine) => {
    return strLine.includes(STR_DECLARE_START);
}
const extractFirstKeyword = (/** @type {string} */ strLine) => {
    strLine = strLine.trim();
    let auxBuffer = strLine.match(/[a-zA-Z_][a-zA-Z_0-9]*;?/)
    if (auxBuffer.length > 0 && auxBuffer.at(auxBuffer.length - 1) == ';')
        auxBuffer.length -= 1;
    return auxBuffer[0];
}
const getExtBlock = (/** @type {vscode.TextDocument} */ fHandle, /** @type {number} */ nLine, /** @type {number} */ limitLine) => {
    const EXT_REG_KEYWORDS = [/\{struct=(.+)\}/, /\{enum=(.+)\}/, /\{macro=(.+)\}/];
    const KEYWORDS_TYPES = ["Struct", "Enum", "Macro"];
	let syntaxGroup = {type: "None", name: ""};
	const DECLARED_LINE = fHandle.lineAt(nLine).text;
	EXT_REG_KEYWORDS.forEach((regExpr, index) => {
		if (syntaxGroup.type == "None") {
			const matchers =  DECLARED_LINE.match(regExpr); //on each line is possible to use only one
			if (matchers != null && matchers.length == 2) {
				syntaxGroup.type = KEYWORDS_TYPES.at(index);
				syntaxGroup.name = matchers.at(1);
			}
		}
	})
    nLine += 1; //to next line
    const DESCRIPTION_LINE = fHandle.lineAt(nLine).text;
    if (DESCRIPTION_LINE.match(/;@Description *.+\n?/)) {//todo: add description
        nLine += 1;
    }
    let docsInfo = null;
    let nextLine = "";
    let pattern;
    switch (syntaxGroup.type) {
        case "Struct":
            let fields = [];
            pattern = /\.([^ \n]+)/
            while (nLine < fHandle.lineCount && !(nextLine = fHandle.lineAt(nLine).text).match(/ *\} *(;.*\n?)?/)) {
                let dummyField = nextLine.match(pattern);
                if (dummyField != null && dummyField.length == 2) {
                    fields.push(dummyField[1]);
                }
                nLine += 1;
            }
            docsInfo = new DocsStructInfo(syntaxGroup.name, fields);
            break;
        case "Enum":
            let values = [];
            pattern = /^[^\.]+\.([^ \n]+)/;
            while (nLine < fHandle.lineCount && (nextLine = fHandle.lineAt(nLine).text).includes(syntaxGroup.name)) {
                let dummyValues = nextLine.match(pattern);
                if (dummyValues != null && dummyValues.length == 2) {
                    values.push(dummyValues[1]);
                }
                nLine += 1;
            }
            docsInfo = new DocsEnumInfo(syntaxGroup.name, values);
            break;
        case "Macro": 
            const pieces = syntaxGroup.name.split(".", 2);
            if (pieces.length < 2) {
                pieces.push(null);
            }
            docsInfo = new DocsMacroInfo(pieces[0], pieces[1]);
            break;
    }
    return docsInfo != null ? DocsBlock.valueOf(nLine, docsInfo) : null;
}
const getDocsBlock = (/** @type {vscode.TextDocument} */ fHandle, /** @type {number} */ nLine, /** @type {number} */ limitLine) => {
    let startLine = nLine;
    let buffString = fHandle.lineAt(nLine).text;
    if (buffString.indexOf(STR_DOCS_START) != 0)
        return hasExtSyntax(buffString) ? getExtBlock(
            fHandle, nLine, limitLine) : null;
    nLine += 1;
    while ((nLine < limitLine) && fHandle.lineAt(nLine).text.indexOf(';') != -1)
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
const getFirstName = (/** @type {vscode.TextDocument} */ fHandle, /** @type {number} */ nLine) => {
    let buffString = fHandle.lineAt(nLine).text;
    let arrString = buffString.split(' ', 3);
    let funcName;
    if (arrString[0] == excludeKeyword)
        funcName = arrString[1];
    else
        funcName = arrString[0];
    return funcName;
}

function getLastSourceIndex() {
    return fileIndex.getCurrentIndex();
}
/**
 * @param {vscode.TextDocument} document
 */
function setCurrentFile(document) {
    fileIndex.add(document.fileName);
}
/**
 * @param {{ fileName: string; }} document
 */
function getSourceId(document) {
    return fileIndex.getFileIndex(document.fileName);
}
/**
 * @param {any} fileId
 */
function getSourceLinks(fileId) {
    return fileIndex.getLinks();
}
/**
 * @param {vscode.TextDocument} document
 */
function saveSourceLinks(document) {
    fileIndex.saveLinks(document);
}
//if error return -1
//else return 0;
const addToIndex = (/** @type {vscode.TextDocument} */ fHandle) => {
    let currLine = 0;
    let lineCnt = fHandle.lineCount;
    NodeInfo.setGlobalOrigin(fHandle.fileName);
    while (currLine < lineCnt) {
        let buffDocs = null;
        while (buffDocs == null && currLine < lineCnt) {
            buffDocs = getDocsBlock(fHandle, currLine, lineCnt);
            currLine++;
        }
        if (buffDocs == null || lineCnt < buffDocs.nextLine)
            break;
        currLine = buffDocs.nextLine;
        let moduleType = DocsBlockType.convertToModule(buffDocs.type);
        const CURRENT_SOURCE_ID = getLastSourceIndex();
        if (buffDocs.type == DocsBlockType.Functional) {
            let funcName = getFirstName(fHandle, currLine++);
            if (funcName.charAt(0) != '.' && typeof(buffDocs.block) == "string") { //if not internal label
                const docsContent = buffDocs.block.toString();
                let funcNode = new FuncHashNode(funcName,
                    new Functional(docsContent));
                funcNode.setSourceId(CURRENT_SOURCE_ID);
                hashTable.add(funcNode, moduleType);
            }
        }
        else {
            if (buffDocs.block instanceof DocsInfo) {
                const docsInfo = buffDocs.block;
                let nodes = null;
                switch (docsInfo.type) {
                    case DocsBlockType.Enum:    
                        if (docsInfo instanceof DocsEnumInfo) {
                            nodes = HashNode.arrayOf(docsInfo.name, docsInfo.values);
                        }
                    case DocsBlockType.Struct:
                        if (docsInfo instanceof DocsStructInfo) {
                            nodes = HashNode.arrayOf(docsInfo.name, docsInfo.fields);
                        }
                    case DocsBlockType.Macro:
                        if (docsInfo instanceof DocsMacroInfo) {
                            nodes = [];
                            nodes.push(HashNode.valueOf(docsInfo.name, docsInfo.binding));
                        }
                    
                }
                if (nodes != null){
                    nodes.forEach(node => node.setSourceId(CURRENT_SOURCE_ID));
                    hashTable.addAll(nodes, moduleType);
                }
            }
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
    lastHandle = null; //handler that using after fulling indexation 
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

        filesPromise.then((arrFiles) => {
            if (arrFiles.length == 0)
                this.errorHandle();
            let fileCnt = 0;
            arrFiles.forEach((/** @type {vscode.Uri} */ fileUri) => {
                let fHandle = vscode.workspace.openTextDocument(fileUri);
                fHandle.then((file) => {
                    this.indexHandle(file);
                    fileCnt += 1;
                    if (fileCnt == arrFiles.length)
                        this.lastHandle();
                });

            });

        }, this.errorHandle);
    }
    //or by ignore file, or by array
    setIgnoreFiles = (/** @type {string[]}*/ sourceFiles = []) => {
        this.ignoreFiles = sourceFiles;
        if (sourceFiles.length != 0) {
            return new Promise((resolve) => {
                resolve();
            })
        }

        let filePromise = vscode.workspace.findFiles(IndexMemory.getIgnoreSourceName(), undefined, 1);
        let promiseResult = new Promise((resolve, reject) => {
            filePromise.then((arrFiles) => {
                let fHandle = vscode.workspace.openTextDocument(arrFiles[0]);
                fHandle.then((document) => {
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
        while (iLine < lineCnt) {
            buffString = fHandle.lineAt(iLine).text;
            buffString.trim();
            if (buffString.length != 0)
                arrResult.push(buffString);
            iLine += 1;
        }
        return arrResult;
    }
    static IGNORE_FILE_NAME = ".fasmignore";
    static convertTemplate = (/** @type {string[]} */ arrExts, /** @type {string} */ strHeader = "**/*.") => {
        if (arrExts.length == 0)
            return (strHeader.length == 0) ? null : strHeader + "*";

        let result = strHeader + '{';
        arrExts.forEach(extValue => {
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
const fileIndex = new FileIndex();

const initIndex = () => {
    hashTable.clear(); //todo: replace with adaptive changing
    indexMemory.setIgnoreFiles().then(indexMemory.init, indexMemory.errorHandle);
    MessageSender.send("Indexation completed")

};

const findCompilationCause = (/** @type {vscode.GlobPattern} */ fileName) => {
    vscode.workspace.findFiles(fileName, null, 1).then((arrFilesUri) => {
        if (arrFilesUri.length == 0)
            return;
        vscode.workspace.openTextDocument(arrFilesUri[0]).then(document => {
            let lineCnt = document.lineCount;
            let iLine = 0;
            let buffString = '';
            let resultLine = -1;
            let arrString = [];
            while (iLine < lineCnt) {
                buffString = document.lineAt(iLine).text;
                arrString = buffString.match("\\[[0-9]+\\]");
                if (arrString != null)
                    break;
                iLine += 1;
            }
            if (iLine != lineCnt) {
                vscode.window.showErrorMessage("Hello World");
            }

        });
    });
}
const getCompilerFileInfo = () => "Dummy@@File.dummy";
const compileProject = (/** @type {vscode.TextEditor} */ editor, /** @type {any} */ edit, /** @type {any} */ args) => {
    if (osMode == OperationSystem.Unknown) {
        MessageSender.send("Unknown operation system");
        return;
    }
    let strCommand;
    let terminal;
    let sourceFile = editor.document.fileName;
    let fileInfo = getCompilerFileInfo();
    if (vscode.window.terminals.length == 0)
        terminal = vscode.window.createTerminal(`fasm terminal`);
    else
        terminal = vscode.window.terminals.at(0);
    switch (osMode) {
        case OperationSystem.Win:
            strCommand = `${CompillerPath} ${sourceFile}`;
            break;
        case OperationSystem.Linux:
            strCommand = `${CompillerPath} ${sourceFile}`
            break;
    }
    terminal.sendText(strCommand);
    // let error = new vscode.Diagnostic(
    // 	new vscode.Range(
    // 		new vscode.Position(1, 0),
    // 		new vscode.Position(1, 10)
    // 	), "Error"
    // );

    // let action = new vscode.CodeAction("Error action");

    // terminal.sendText(`rm ${fileInfo}`);
}
var osMode = OperationSystem.Unknown;
const initGlobals = () => {
    CompillerPath = vscode.workspace.getConfiguration(CONFIG_HEADER).get('compiler');
    let workingFolders = vscode.workspace.workspaceFolders;
    if (workingFolders != null) {
        WorkDirectoryPath = vscode.workspace.workspaceFolders[0].uri.path;
    } else {
        let regExpr = new RegExp(/(.+)(\\|\/).+$/);
        let matchers = CompillerPath.match(regExpr);
        WorkDirectoryPath = matchers[1];
    }
    vscode.workspace.getConfiguration(CONFIG_HEADER).get("extensions").forEach((/** @type {string} */ extValue) => {
        indexMemory.addSourceExtension(extValue);
    });
    indexMemory.errorHandle = () => {
        MessageSender.send('Error during index construction');
    }
    indexMemory.indexHandle = (/** @type {vscode.TextDocument}*/ document) => {
        setCurrentFile(document);
        addToIndex(document);
        saveSourceLinks(document);
    }
    indexMemory.lastHandle = () => {
        let isCompleted = fileIndex.normalizeLinks();
        if (!isCompleted)
            MessageSender.send("Some function from import don't highligted")
    }
    switch (system.type()) {
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
    disposable = vscode.commands.registerTextEditorCommand('fasm.compile', compileProject);
    context.subscriptions.push(disposable);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            LANG_NAME, new CompletionItemProvider(), '.', ';@'));
    vscode.languages.registerHoverProvider(LANG_NAME, new HoverProvider());
    initIndex();
}




function deactivate() { }

module.exports = {
    activate,
    deactivate
}
