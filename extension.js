const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
const LANG_NAME = 'fasm-x86_64';

const initIndex = () => {
	vscode.window.showInformationMessage('Dummy work!');
	
};
function activate(context) {
	let disposable = vscode.commands.registerCommand('fasm.initIndex', initIndex);	
	context.subscriptions.push(disposable);

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
