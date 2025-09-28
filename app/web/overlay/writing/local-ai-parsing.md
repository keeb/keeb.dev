---
title: AI is great at parsing
date: 2025-09-26
tags:
  - ai
  - automation
  - media
---

I've been writing a [media management service](https://github.com/keeb/media-management-service) for years. Think of it like the *arr services, only less cohesive and more brittle. It's exactly how I want to manage *my* media, not how anyone else should manage *theirs*. When I'm feeling inspired to create, or just bored, this is the project I work on. 

At the heart of every good catalogue is the ability to sort and store arbitrary inputs. What that usually devolves into, is a [parser](https://github.com/keeb/media-management-service/blob/main/mediaservice/parse.py) of some sort. I tweaked this mother fucker constantly. It's not very good, or computer sciencey, but it worked most of the time.

I got tired of manually sorting thousands of files into the right directories and managing this brittle parsing process, especially when it broke. So I taught a local AI to do it for me.

# The problem

Media filenames are chaos. `The.Sopranos.S01E01.Pilot.avi` sits next to `Attack on Titan - 01 [1080p].mkv` and `The Matrix (1999) 1080p BluRay.mp4`. Different formats, different naming conventions, same problem: figuring out what each file is and where it belongs. Even worse when there's arbitrary `fields` that the filename can contain, like `The Handmaid'\''s Tale (2017) - S02E01 - June (1080p BluRay x265 Silence).mkv`.

Because of the distributed nature of the system and the fact that files are unsorted by nature when they arrive, there's nothing I can do ahead of time to "pre-sort." Anything can show up at any time in a central location for processing. I call this the staging area, or just `staging`. 

# Two prompts, one system

The system uses two specialized prompts that work together:

1. [filename-to-json.prompt](https://github.com/keeb/media-management-service/blob/main/prompts/filename-to-json.prompt) parses any media filename into structured JSON
2. [json-to-save-path.prompt](https://github.com/keeb/media-management-service/blob/main/prompts/json-to-save-path.prompt) takes that JSON and returns the exact storage path

## filename-to-json

The first prompt handles the hardest part: making sense of the filename chaos. It classifies files into TV shows, Anime, Movies, or Books, then extracts metadata like season, episode, title, and year.

```json
{
  "media_type": "tv_show", 
  "title": "The Sopranos", 
  "season": 1, 
  "episode": 1, 
  "episode_title": "Pilot", 
  "year": null, 
  "confidence": "High"
}
```

I taught it to recognize patterns rather than memorizing formats. Movies don't contain Season or Episode markers. `S01E01` maps to season 1/episode 1, square brackets contain quality info, and parentheses with years indicate movies.

Then I added examples. Think of these like test cases. Provide sample input, provide exact output. This works well.

> Input: `Call of the Night v01 (2021) (Digital) (1r0n) (f2).cbz`
> Output: `{"media_type": "book", "title": "Call of the Night", "season": null, "episode": null, "volume": 1, "episode_title": null, "year": 2021, "confidence": "High"}`

I don't actually use the confidence scoring. It only matters on low quality models. High quality models basically always get it right. When there's an issue, all LLM interactions are saved for debugging and prompt refinement. 

## json-to-save-path

One of the main reasons I do not like the *arr services is that I cannot customize how the resulting files are stored on disk. Everything is stored according to some simple rules:
- Anime: `/home/keeb/media/video/anime/completed/{show-name}`
- TV Shows: `/home/keeb/media/video/shows/{show-name}/s{season}`  
- Movies: `/home/keeb/media/video/movies`
- Books: `/home/keeb/media/manga/{book-title}/v{volume}`

You can see how extensible this scheme could be - if I wanted to start archiving audio books, I would think about how I would want to store it, then just write this rule.

Since I do a lot of work in the command line, I do not like special characters or spaces and a few other oddities. Here's my complete rules for names. This keeps things neat!


> Follow these steps exactly in order:
> 1. Convert title to lowercase
> 2. Replace ALL spaces with single hyphens
> 3. Remove trailing separators (spaces, hyphens, dots, underscores)  
> 4. Remove duplicate hyphens (-- becomes -)
> 5. Strip leading/trailing hyphens


## Legacy, special rules, exceptions

Obviously, this system pre-dated the use of AI in this way, and, unsurprisingly, I don't always follow my own rules. What is surprising is exception handling just kind of works. On [line 25](https://github.com/keeb/media-management-service/blob/main/prompts/json-to-save-path.prompt#L25C1-L25C115) of the prompt you can see a clear example

> "Yofukashi no Uta S2" is a special case. it goes to /home/keeb/media/video/anime/completed/call-of-the-night/s2/

In this case, I stored file as the English name of the Anime instead of the original.


## Performance

It correctly classifies about 95% of files on the first pass. The confidence scoring helps identify the 5% that need manual review. Most failures happen with obscure formats, genuinely ambiguous files, or when I download something with a completely fucked filename like `hdtv-lol-omgwtfbbq-x264-2160p.mkv`.

Path generation works well once classification succeeds. Directory structure rules are deterministic, so if the JSON is right, the path will be right.

## Debugging and Refinement

The worker logs every LLM interaction as JSON files containing input, output, and metadata. When the AI gets something wrong, which is very rare, you can examine exactly what it saw and how it responded. This debug data helps refine the prompts. I've used failed cases to add examples and improve pattern recognition.

```python
# Example debug log structure
{
  "timestamp": "2025-01-15T14:30:25",
  "job_id": "507f1f77bcf86cd799439011", 
  "filename": "Attack.on.Titan.S04E28.mkv",
  "step": "filename_to_json",
  "input": "Attack.on.Titan.S04E28.mkv",
  "output": "{\"media_type\": \"anime\", \"title\": \"Attack on Titan\", ...}"
}
```

# The pattern generalizes

Two specialized prompts, each focused on one transformation, connected by structured data. I've started to apply this to log parsing, document classification, or any problem where I need to extract structure from messy input.

Keep each prompt focused and testable. Provide rules, not structure. Be explicit. See x? Do y. When something breaks, you know exactly which step failed and can fix it without touching the rest of the system.


# Why local?

With the parsing system working well, the next question was where to run it. Cloud APIs are the obvious choice, but I have a lot of hardware and it brings me great joy to use it and to understand, at some fundamental level, how it all works.

Turns out, even low powered models do a fairly good job at this. Finding the right model was half of the fun. I tried low quality models like `qwen3:0.6b`, `deepseek-r1:1.5b` and medium quality models like `dolphin3`.

The machine the LLM inference was originally running on was running a `NVIDIA GTX 970` and it worked.. slowly, and poorly. But it worked!

Upgrading the hardware a little bit solved a lot of problems:

- Zero latency once the model loads
- No API costs scaling with usage
- Complete privacy for your media collection
- Works offline
- Full control over the prompts and logic

Is that worth it? Who knows, but it's fun and it works, so it's good enough for me.

# Conclusion

This project taught me that AI is exceptionally good at classification and pattern matching. I guess I shouldn't be surprised, it's literally what AI is. The structure of the prompt was the most enlightening.

The real lesson isn't about media management, it's about recognizing where AI naturally excels. Classification problems that would take hundreds of lines of parsing logic can often be solved with clear examples and well-structured prompts. I've started looking for these patterns everywhere: log parsing, document classification, data extraction from messy inputs.

Sometimes the right tool makes a hard problem trivial.
