import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ImageScreenLogic')
export class ImageScreenLogic extends Component {
    @property(Label)
    label: Label = null;

    start() {
        if (this.label) {
            this.label.string = "This version updated version 1.0.1";
        }
    }
}


