const vscode = require('vscode');
class DescriptionStage {
	static InfoPart = 0;
	static InputPart = 1;
	static OutputPart = 2;
	static NotesPart = 3;
	static AssumePart = 4;
}
class Functional {
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
	savePart = (stage, arrInfo) => {
		switch(stage){
			case DescriptionStage.InputPart:
				this.strInput = Functional.exctractInputInfo(arrInfo);
				break;
			case DescriptionStage.OutputPart:
				this.strOutput = Functional.extractOutputInfo(arrInfo);
				break;
			case DescriptionStage.AssumePart:
			case DescriptionStage.NotesPart:
				this.strNotes = Functional.extractAuxInfo(arrInfo);
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

export {
    Functional
}