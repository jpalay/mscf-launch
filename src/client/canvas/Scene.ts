import * as Helpers from "./helpers";
import * as Player from "./Player";
import * as OtherPlayer from "./OtherPlayer";
import * as CurrentPlayer from "./CurrentPlayer";
import * as ServerInterfaces from "../../ServerInterfaces";

export interface WorldObject {
    objectType: "sprite" | "solid";
    render(canvas: HTMLCanvasElement): void;
}

export interface StaticObject extends WorldObject {
    objectType: "solid"
    blocksPoint: (testPoint: Helpers.Coordinate) => boolean;
}

export interface Sprite extends WorldObject {
    objectType: "sprite"
    updateState(scene: Scene): void;
    render(canvas: HTMLCanvasElement): void;
}

export type State = {
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
    socket: SocketIOClient.Socket;
    staticObjects: StaticObject[];
    players: Player.Player[];
    state: State;
    currentPlayerName: string | null;
    addPlayerCallback: () => void;

    constructor({
        socket,
        staticObjects,
        addPlayerCallback
    }: {
        socket: SocketIOClient.Socket,
        staticObjects: StaticObject[],
        addPlayerCallback: () => void
    }) {
        this.socket = socket;
        this.players = [];
        this.staticObjects = staticObjects;
        this.currentPlayerName = null;
        this.addPlayerCallback  = addPlayerCallback;
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
                this._addNewPlayers(message);
            }
        });
    }

    private _addNewPlayers = (message: ServerInterfaces.RegisterUserResponse) => {
        const newPlayerDescriptors = message.allPlayers.filter(
            playerDescriptor => this.players.findIndex(
                player => player.name === playerDescriptor.name
            ) === -1
        );

        const newPlayers = newPlayerDescriptors.map(playerDescriptor =>
            this.currentPlayerName !== null && this.currentPlayerName === playerDescriptor.name
                ? new CurrentPlayer.CurrentPlayer(this.socket, playerDescriptor)
                : new OtherPlayer.OtherPlayer(this.socket, playerDescriptor)
        );

        this.players = this.players.concat(newPlayers);

        // move the current player to the back, so it's always rendered last and on top
        const currentPlayer = this.currentPlayer();
        const currentPlayerIndex = currentPlayer !== null
            ? this.players.indexOf(currentPlayer)
            : -1;

        if (currentPlayerIndex !== -1) {
            this.players.push(
                // removes the element from this.players, and returns it as an array
                this.players.splice(currentPlayerIndex, 1)[0]
            );
        }

        if (newPlayers.length !== 0) {
            this.addPlayerCallback();
        }
    }

    private _renderScene(canvas: HTMLCanvasElement) {
        const context = Helpers.getContext(canvas);

        context.clearRect(0, 0, canvas.width, canvas.height);
        this.staticObjects.forEach(staticObject => {
            staticObject.render(canvas);
        })
        this.players.forEach(player => {
            player.render(canvas);
        });
    }

    private _updateState() {
        this.state.ticks += 1;
        this.players.forEach(player => { player.updateState(this) });
    }

    currentPlayer() {
        const currentPlayer = this.players.filter(player => player.name === this.currentPlayerName)[0];
        return currentPlayer ? currentPlayer : null;
    }

    run(canvas: HTMLCanvasElement) {
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
            this.state.mouse.x = event.clientX - canvas.getBoundingClientRect().left;
            this.state.mouse.y = event.clientY - canvas.getBoundingClientRect().top;
        });

        document.addEventListener('mousedown', event => {
            this.state.mouse.pressed = true;
        });

        document.addEventListener('mouseup', event => {
            this.state.mouse.pressed = false;
        });

        return window.setInterval(
            () => {
                this._updateState();
                this._renderScene(canvas);
            },
            33
        )
    }
}
