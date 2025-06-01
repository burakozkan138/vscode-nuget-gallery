import * as vscode from 'vscode';

export class NuGetCodeActionProvider implements vscode.CodeActionProvider {
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    if ( document.languageId !== 'csharp' ) {
      return actions;
    }

    const unresolvedTypeDiagnostics = context.diagnostics.filter(
      diagnostic => this.isUnresolvedTypeDiagnostic( diagnostic )
    );

    for ( const diagnostic of unresolvedTypeDiagnostics ) {
      const typeName = this.extractTypeNameFromDiagnostic( diagnostic, document );
      if ( typeName ) {
        const action = new vscode.CodeAction(
          `🔍 Find '${typeName}' in NuGet packages`,
          vscode.CodeActionKind.QuickFix
        );

        action.command = {
          command: 'nuget-gallery.findType',
          title: 'Find in NuGet',
          arguments: [typeName]
        };

        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push( action );
      }
    }

    return actions;
  }

  private isUnresolvedTypeDiagnostic( diagnostic: vscode.Diagnostic ): boolean {
    return diagnostic.code === 'CS0246' ||  // type or namespace name could not be found
      diagnostic.code === 'CS0234' ||       // type or namespace name does not exist
      diagnostic.code === 'CS0103' ||       // name does not exist in current context
      diagnostic.code === 'CS0116' ||       // namespace cannot directly contain members
      diagnostic.severity === vscode.DiagnosticSeverity.Error &&
      ( diagnostic.message.includes( 'does not exist' ) ||
        diagnostic.message.includes( 'could not be found' ) ||
        diagnostic.message.includes( 'are you missing' ) ||
        diagnostic.message.includes( 'using directive' ) ||
        diagnostic.message.includes( 'assembly reference' ) );
  }

  private extractTypeNameFromDiagnostic(
    diagnostic: vscode.Diagnostic,
    document: vscode.TextDocument
  ): string | null {
    const messagePatterns = [
      /'([^']+)'/,
      /`([^`]+)`/,
      /type or namespace name '([^']+)'/,
      /name '([^']+)' does not exist/,
    ];

    for ( const pattern of messagePatterns ) {
      const match = diagnostic.message.match( pattern );
      if ( match && match[1] ) {
        return this.cleanTypeName( match[1] );
      }
    }

    const text = document.getText( diagnostic.range ).trim();
    if ( text ) {
      return this.cleanTypeName( text );
    }

    return null;
  }

  private cleanTypeName( typeName: string ): string | null {
    if ( !typeName ) return null;

    let cleaned = typeName.replace( /<.*?>/, '' );
    cleaned = cleaned.replace( /\[\]/, '' );
    const parts = cleaned.split( '.' );
    cleaned = parts[parts.length - 1];
    cleaned = cleaned.trim();
    cleaned = cleaned.replace( /[^\w]/g, '' );

    if ( cleaned.length < 2 || /^\d/.test( cleaned ) ) {
      return null;
    }

    return cleaned;
  }
}