import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameContent')
export class GameContent extends Component {
    @property(Label)
    label: Label = null;

    onLoad() {
        console.log("onLoad is called version 1.0.1")
        if (this.label) {
            this.label.string = "Inital one update by thanis";
        }
    }
}


