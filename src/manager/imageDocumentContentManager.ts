import { TextEditor, Uri, ViewColumn } from "vscode";
import { DocumentContentManagerInterface } from "./documentContentManagerInterface";
import { HtmlPreview, SourceType } from "../util/htmlPreview";
import { TextEditorHelper, TextEditorHelperReturnType } from "../util/textEditorHelper"

export class ImageDocumentContentManager implements DocumentContentManagerInterface {


    private IMAGE_TYPE_REGREX_PREFFIX: RegExp = /http[s]{0,1}:\/\/|file:\/\/|\s[\.]{0,2}\//;
    private IMAGE_TYPE_REGREX_SUFFIX: RegExp = /png|jpg|jpeg|gif|bmp|\s/;
    private IMAGE_TYPE_REGREX_SPLIT: RegExp = /\s/;


    private _editor: TextEditor;

    public constructor(editor: TextEditor) {
        this._editor = editor;
        return this;
    }


    // @Override
    public editor(): TextEditor {
        return this._editor;
    }


    // 生成当前编辑页面的可预览代码片段
    // @Override
    public async createContentSnippet(): Promise<string> {
        let editor = this._editor;
        if (!editor) {
            return HtmlPreview.errorSnippet(this.getWindowErrorMessage());
        }
        let previewSnippet: string = await this.generatePreviewSnippet(editor);
        if (!previewSnippet || previewSnippet.length <= 0) {
            return HtmlPreview.errorSnippet(this.getErrorMessage());
        }
        console.info("previewSnippet = " + previewSnippet);
        return previewSnippet;
    }

    // @Override
    public sendPreviewCommand(previewUri: Uri, displayColumn: ViewColumn): Thenable<void> {
        return HtmlPreview.sendPreviewCommand(previewUri, displayColumn);
    }

    private getErrorMessage(): string {
        return `Active editor doesn't show any  ${this.IMAGE_TYPE_REGREX_SUFFIX} - no properties to preview.`;
    }
    private getWindowErrorMessage(): string {
        return `No Active editor - no properties to preview.`;
    }
    private imageSrcSnippet(imageUri: string): string {
        return HtmlPreview.createRemoteSource(SourceType.IMAGE, imageUri);
    }

    // 获取指定位置开始后的第一个分隔符的位置
    private indexOfSplit(editor: TextEditor, startPos: number): TextEditorHelperReturnType {
        return TextEditorHelper.regexIndexOf(editor, startPos, this.IMAGE_TYPE_REGREX_SPLIT);
    }
    // 获取指定位置开始前的第一个资源前缀的位置
    private lastIndexOfPrefix(editor: TextEditor, startPos: number): TextEditorHelperReturnType {
        return TextEditorHelper.regexLastIndexOf(editor, startPos, this.IMAGE_TYPE_REGREX_PREFFIX);

    }
    // 获取指定位置开始前的第一个资源前缀的位置
    private lastIndexOfSuffix(editor: TextEditor, startPos: number): TextEditorHelperReturnType {
        return TextEditorHelper.regexLastIndexOf(editor, startPos, this.IMAGE_TYPE_REGREX_SUFFIX);

    }
    // 获取指定位置开始后的第一个分隔符前的最后一个后缀的位置
    private getEndOfImageUrl(editor: TextEditor, startPosOfImageUrl: number, startPosOfSplit: number): number {
        if (!editor) {
            return -1;
        }
        let startIndexOfSuffix: TextEditorHelperReturnType = this.lastIndexOfSuffix(editor, startPosOfSplit);
        let startPosOfSuffix = startIndexOfSuffix.pos;
        let selectedSuffix = startIndexOfSuffix.mark;
        if (startPosOfSuffix < 0) {
            return startPosOfSplit;
        } else {
            if (startPosOfSuffix < startPosOfImageUrl) {
                return -1;
            }
            if (selectedSuffix.match(/\s*/)) {
                return startPosOfSuffix
            }
            return startPosOfSuffix + selectedSuffix.length;
        }
    }
    private getSplitOfImageUrl(editor: TextEditor, startIndexOfImageUrl: TextEditorHelperReturnType): number {
        if (!editor) {
            return -1;
        }

        let startPosOfSplit = this.indexOfSplit(editor, startIndexOfImageUrl.pos + startIndexOfImageUrl.mark.length).pos;

        if (startPosOfSplit < 0) {
            startPosOfSplit = editor.document.getText().length;
        }
        return startPosOfSplit;
    }

    private getFirstSelectedImageUri(editor: TextEditor): string {
        if (!editor) {
            return "";
        }
        // 获取当前鼠标选中段落的起始位置        
        let startPosOfSelectionText = editor.document.offsetAt(editor.selection.anchor);

        let startIndexOfImageUrl = this.lastIndexOfPrefix(editor, startPosOfSelectionText);
        let startPosOfImageUrl = startIndexOfImageUrl.pos;
        if (startPosOfImageUrl < 0) {
            return "";
        }

        let startPosOfSplit = this.getSplitOfImageUrl(editor, startIndexOfImageUrl);

        let endNextPosOfImageUrl: number = this.getEndOfImageUrl(editor, startPosOfImageUrl, startPosOfSplit);

        if (endNextPosOfImageUrl < 0) {
            return "";
        }
        let imgSrcUri: string = editor.document.getText().slice(startPosOfImageUrl, endNextPosOfImageUrl);
        return imgSrcUri;
    }

    // 生成预览编辑页面
    private async generatePreviewSnippet(editor: TextEditor): Promise<string> {
        if (!editor) {
            return HtmlPreview.errorSnippet(this.getWindowErrorMessage());
        }
        let imageUri = this.getFirstSelectedImageUri(editor);
        if (!imageUri || imageUri.length <= 0) {
            return HtmlPreview.errorSnippet(this.getErrorMessage());
        }

        let targetImageUri: string = imageUri;//await HtmlUtil.fixImageRedirectUrl(imageUri);

        let head = HtmlPreview.fixImageSrcLinks(HtmlPreview.createLocalSource(SourceType.LINK, "header_fix.css"));
        let body = HtmlPreview.createRemoteSource(SourceType.DIVISION, targetImageUri) +
            HtmlPreview.createRemoteSourceAtNewline(SourceType.HR) +
            HtmlPreview.createRemoteSource(SourceType.CUSTOM_NEWLINE) +
            HtmlPreview.fixImageSrcLinks(this.imageSrcSnippet(targetImageUri));
        return HtmlPreview.createFullHtmlSnippetFrom(head, body);
    }

}