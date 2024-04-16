import { Message } from "discord.js";

import { customClient } from "../../../typings/client";
import { runningUnoGame, unoGame } from "../../../typings/unoGame";
import runningGameMessage from "../../components/runningGameMessage";
import { Buno } from "../../database/models/buno";
import { averageUnoGameCount, defaultSettings } from "../constants";
import timeouts from "../timeoutManager";
import draw from "./draw";
import onTimeout from "./onTimeout";
import use from "./use";

export default async (client: customClient, game: unoGame, automatic: boolean, message: Message) => {
    if (automatic && game.players.length < 2 && game._modified !== true) {
        client.games.splice(client.games.findIndex(g => g === game), 1);
        return message.edit({ content: `No one was available to play with ${message.guild.members.cache.get(game.hostId).toString()}.`, components: [], embeds: [] });
    }
    const dbReq = await Buno.findOne({
        where: {
            userId: game.hostId,
            guildId: message.guildId
        }
    });
    game.settings = {
        ...defaultSettings,
        ...dbReq.getDataValue("settings")
    };
    game.state = "inProgress";
    game = game as runningUnoGame;
    game.cards = {};
    game.cardsQuota = {
        ...averageUnoGameCount()
    };
    game.players.forEach(p => {
        game.cards[p] = draw(game.cardsQuota, 7);
    });
    if (game.settings.randomizePlayerList) game.players = shuffleArray(game.players);
    game.playersWhoLeft = [];
    game.turnProgress = "chooseCard";
    game.drawStack = 0;
    game.turnCount = 0;
    game.canSkip = false;
    game.playedCard = undefined;
    game.unoPlayers = [];
    game.saboteurs = {};
    game.adminAbused = false;
    game.messageCount = 0;
    game.currentCard = draw(game.cardsQuota, 1, true)[0];
    use(game, game.currentCard, "0");
    game.log = [{ player: "0", card: game.currentCard, adminAbused: false }];
    game.currentPlayer = game.players[0];
    await message.delete();
    game.startingDate = new Date(Date.now());
    await message.channel.send(`**The game has just started!**${game.settings.adminabusemode === true ? "\nThe admin abuse gamemode is enabled for this game. You can eject the host if you think they are abusing by opening the Actions menu" : ""}`);
    const msg = await message.channel.send(await runningGameMessage(game, message.guild));
    game.messageId = msg.id;
    timeouts.set(game.channelId, () => onTimeout(client, game, game.currentPlayer), game.settings.timeoutDuration * 1000);
};

function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
