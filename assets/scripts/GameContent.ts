import { _decorator, Component, Label, native, Node } from 'cc';
import { NATIVE } from 'cc/env';
const { ccclass, property } = _decorator;

@ccclass('GameContent')
export class GameContent extends Component {
    @property(Label)
    label: Label = null;

    onLoad() {
      
        console.log("onLoad is called version 1.0.3")
        if (this.label) {
            this.label.string = "Inital one ";
        }
    }
}


