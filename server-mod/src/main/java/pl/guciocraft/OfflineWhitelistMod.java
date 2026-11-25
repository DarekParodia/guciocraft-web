package pl.guciocraft;

import com.mojang.authlib.GameProfile;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.exceptions.SimpleCommandExceptionType;
import java.io.IOException;
import java.util.regex.Pattern;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.chat.Component;
import net.minecraft.server.players.UserWhiteList;
import net.minecraft.server.players.UserWhiteListEntry;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;

@Mod(value = "guciocraft_offline_whitelist", dist = Dist.DEDICATED_SERVER)
public final class OfflineWhitelistMod {
    private static final Pattern NICKNAME = Pattern.compile("[A-Za-z0-9_]{3,16}");

    public OfflineWhitelistMod() {
        NeoForge.EVENT_BUS.addListener(this::registerCommands);
    }

    private void registerCommands(RegisterCommandsEvent event) {
        var nickname = Commands.argument("nickname", StringArgumentType.word())
            .executes(context -> add(context.getSource(), StringArgumentType.getString(context, "nickname")));
        event.getDispatcher().register(Commands.literal("whitelist-offline")
            .requires(source -> source.hasPermission(4))
            .then(Commands.literal("add").then(nickname)));
    }

    private int add(CommandSourceStack source, String nickname) throws CommandSyntaxException {
        if (source.getServer().usesAuthentication()) {
            throw failure("Offline whitelist requires online-mode=false");
        }
        if (!NICKNAME.matcher(nickname).matches()) {
            throw failure("Invalid Minecraft nickname");
        }

        GameProfile profile = UUIDUtil.createOfflineProfile(nickname);
        UserWhiteList whitelist = source.getServer().getPlayerList().getWhiteList();
        boolean alreadyPresent = whitelist.isWhiteListed(profile);
        if (!alreadyPresent) {
            whitelist.add(new UserWhiteListEntry(profile));
        }
        try {
            // StoredUserList.add logs write errors internally. Check persistence before acknowledging RCON.
            whitelist.save();
        } catch (IOException e) {
            if (!alreadyPresent) {
                whitelist.remove(profile);
            }
            throw failure("Unable to save offline whitelist");
        }

        String outcome = alreadyPresent ? "already" : "added";
        source.sendSuccess(() -> Component.literal("GUCIOCRAFT_WHITELIST " + outcome + " " + nickname), false);
        return 1;
    }

    private static CommandSyntaxException failure(String message) {
        return new SimpleCommandExceptionType(Component.literal(message)).create();
    }
}
