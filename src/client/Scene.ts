import { CurrentPlayer } from "./CurrentPlayer";
import * as Helpers from "./helpers";
import * as OtherPlayer from "./OtherPlayer";
import * as ServerInterfaces from "../ServerInterfaces";

export interface WorldObject {
    objectType: "sprite" | "solid";
    render(canvas: HTMLCanvasElement): void;
}

export interface SolidObject extends WorldObject {
    objectType: "solid"
    blocksPoint: (testPoint: Helpers.Coordinate) => boolean;
}

export interface Sprite extends WorldObject {
    objectType: "sprite"
    updateState(scene: Scene): void;
    render(canvas: HTMLCanvasElement): void;
}

export type SceneState = {
    ticks: number;
    keyboard: {
        space: boolean;
    },
    mouse: {
        x: number;
        y: number;
        pressed: boolean;
    }
};

export class Scene {
    canvas: HTMLCanvasElement;
    socket: SocketIOClient.Socket;
    currentPlayer: CurrentPlayer;
    sprites: OtherPlayer.OtherPlayer[];
    solidObjects: SolidObject[];
    state: SceneState;

    constructor(
		canvas: HTMLCanvasElement,
        socket: SocketIOClient.Socket,
        currentPlayer: CurrentPlayer,
        sprites: OtherPlayer.OtherPlayer[],
        solidObjects: SolidObject[]
    ) {
        this.canvas = canvas;
        this.socket = socket;
        this.currentPlayer = currentPlayer;
        this.sprites = sprites;
        this.solidObjects = solidObjects;
        this.state = {
            ticks: 0,
            keyboard: {
                space: false
            },
            mouse: {
                x: 0,
                y: 0,
                pressed: false
            }
        };

        this.socket.on("event", (message: ServerInterfaces.ServerResponse) => {
            if (message.eventName === "register_user") {
                if (this.sprites.filter(s => s.id === message.registeredPlayer.id).length === 0) {
                    this.sprites.push(new OtherPlayer.OtherPlayer(this.canvas, this.socket, message.registeredPlayer));
                }
            }
        });
    }

    private _renderScene() {
        const context = Helpers.getContext(this.canvas);

        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.solidObjects.forEach(solidObject => {
            solidObject.render(this.canvas);
        })
        this.sprites.forEach(sprite => {
            sprite.render(this.canvas);
        });
        this.currentPlayer.render(this.canvas);
    }

    private _updateState() {
        this.state.ticks += 1;
        this.sprites.forEach(sprite => { sprite.updateState(this) });
        this.currentPlayer.updateState(this);
    }

    run() {
        // add keyboard listeners
        document.addEventListener('keydown', event => {
            if (event.keyCode === 32) {
                this.state.keyboard.space = true;
            }
        });

        document.addEventListener('keyup', event => {
            if (event.keyCode === 32) {
                this.state.keyboard.space = false;
            }
        });

        // add mouse listeners
        document.addEventListener('mousemove', event => {
            this.state.mouse.x = event.clientX - this.canvas.getBoundingClientRect().left;
            this.state.mouse.y = event.clientY - this.canvas.getBoundingClientRect().top;
        });

        document.addEventListener('mousedown', event => {
            this.state.mouse.pressed = true;
        });

        document.addEventListener('mouseup', event => {
            this.state.mouse.pressed = false;
        });

        setInterval(
            () => {
                this._updateState();
                this._renderScene();
            },
            33
        )
    }
}
