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
- The known network grows while a trace is replayed or recorded.
- Repeated observations consolidate noisy lines into shared map edges.
- New entrances and branches extend the boundary of the known place.
- Unwalked roads remain absent even when public map data exists for the area.

## Deliberate adaptation

The game already knows and displays a conventional illustrated town map. This
project starts from a blank canvas because its real-world premise is stricter:
the user should not receive road knowledge they have not earned. It implements
the fictional software premise, not the game's plot-navigation layer. Story
targets, hidden events, characters, quests, and Memory collection are therefore
deliberately outside the product.

## Fidelity assessment

Version 0.2 corrects an earlier product mistake: reproducing `?`, `!`, people,
and Memory made the prototype resemble the minigame while distracting from the
useful real-world idea. The current demo instead asks whether multiple visits to
one unknown area can progressively recover a coherent local network.

The largest missing pieces are durable graph storage, probabilistic map
matching, intersection cleanup, confidence calibration, and validation against
physical iPhone recordings. Those are the next steps for the actual product.
