// Usage: bun test-rcon.js <host> <port> <password> [command...]
import net from "node:net";

const [host, port, pass, ...cmd] = process.argv.slice(2);

const pkt = (id, type, body) => {
  const b = Buffer.alloc(14 + Buffer.byteLength(body));
  b.writeInt32LE(b.length - 4, 0);
  b.writeInt32LE(id, 4);
  b.writeInt32LE(type, 8);
  b.write(body, 12);
  return b;
};

const s = net.connect(+port, host, () => s.write(pkt(1, 3, pass)));
s.setTimeout(5000, () => { console.log("timeout"); s.destroy(); });
s.on("error", (e) => console.log(e.message));
s.on("data", (d) => {
  const id = d.readInt32LE(4);
  if (id === -1) { console.log("auth failed"); s.end(); }
  else if (id === 1) s.write(pkt(2, 2, cmd.join(" ") || "list"));
  else { console.log(d.toString("utf8", 12, d.length - 2)); s.end(); }
});
