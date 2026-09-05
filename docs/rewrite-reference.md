# Rewrite Mappie reference

This project takes an interaction idea from the fictional Mappie application in
Key's _Rewrite_. It does not reproduce the game's art, map data, story, or
characters.

## What the original interaction does

- Mappie is presented as walking/navigation software whose map records places
  the user has walked. Contemporary coverage described that premise before the
  game's release. ([Dengeki Online](https://dengekionline.com/elem/000/000/318/318600/))
- The game renders it as a point-and-click map. Players move to another location
  through arrows and can trigger actions by probing the map.
  ([Rewrite Wiki](https://rewrite.fandom.com/wiki/Mappie))
- A target indicator points toward the event that progresses the story rather
  than behaving as a north compass. `?` signals open optional material and `!`
  signals advance the story. Completion guides explicitly advise searching for
  `?` before selecting `!` or the arrow to the next map.
  ([GameFAQs guide](https://gamefaqs.gamespot.com/pc/958427-rewrite-2011/faqs/68727))
- The original controls include pan, two-level zoom, optional direction arrows,
  keyboard movement, help, and autoskip. Marker states include a large target,
  movement arrows, visible and cursor-revealed event spheres, person triangles,
  heroine triangles, and a completed state.
  ([Japanese Mappie guide](https://rewrite-key.net/rewrite%E7%99%BA%E5%A3%B2%E5%89%8D%E6%83%85%E5%A0%B1/%E3%83%9E%E3%83%83%E3%83%94%E3%83%BCmappie%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6/))
- Friends and quests found during Mappie segments remain available through the
  persistent Memory menu, making optional exploration part of a collection
  loop. ([Steam completion guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2685164617))

## What Mappie preserves

- Physical movement is the source of map knowledge.
- The known line grows while the trace is replayed or recorded.
- A visible `!` gives the expedition a main direction.
- Optional `?` and person signals appear only after the path gets close.
- Opening a signal changes it to a completed state and increments Memory.
- A player can ignore optional signals and continue toward the target.

## Deliberate adaptation

The game already knows and displays a conventional illustrated town map. This
project starts from a blank canvas because its real-world premise is stricter:
the user should not receive road knowledge they have not earned. It therefore
copies the exploration loop, not the proprietary presentation.

A desktop cursor can sweep for hidden events, but an iPhone has no hover state.
The mobile equivalent is proximity reveal: a signal becomes tappable only when
the growing GPS trace reaches its neighborhood. The included events are clearly
fictional demo content attached to public traces; future personal events will be
local and user-owned.

## Fidelity assessment

Version 0.1 originally reproduced only the map-growth premise. The current demo
also reproduces the target-versus-detour decision and the discovery-to-Memory
feedback loop. It is now directionally faithful to what makes Mappie interesting,
but it is not a complete clone.

The largest missing pieces are durable discoveries on personal recordings,
quest dependencies, people/POI authoring, and road-graph map matching. Those
belong after the GPS and replay foundation is reliable on a physical iPhone.
