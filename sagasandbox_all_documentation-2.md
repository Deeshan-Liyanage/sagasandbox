# SagaSandbox

## Project Description
SagaSandbox: The Agentic Multimodal Storytelling Canvas
🎯 The Goal of the Project
The primary goal of sagasandbox is to revolutionize the way complex stories, world-building lore, and historical or forensic timelines are developed. Instead of forcing creative teams, writers, or investigators to juggle disconnected text scripts, static mood boards, and manual sketch pads, sagasandbox provides a singular, collaborative "living universe." It bridges the gap between raw abstract brainstorming and rich, multi-sensory, cinematic pre-visualization—allowing users to co-author, map out, and immediately watch their worlds come to life in real-time.

🌟 Core Features
The Universe Initializer (Theme & Style Matrix): Before a pen touches the canvas, users define the narrative's sandbox boundaries. This includes selecting a foundational Theme (e.g., Cyberpunk Noir, High Fantasy, Gritty True Crime, Psychological Horror) and an Aesthetic Style (e.g., Photorealistic, Watercolor, Classic 35mm Comic, Neon Futuristic).
The Living Geography Canvas: An interactive, multiplayer digital whiteboard where users sketch out maps, outline floor plans, upload topographical references, or define the zones where events take place. As users draw shapes or block out terrain, a dynamic visual engine constantly converts raw doodles into high-fidelity scenery backdrop concepts.
The Chronological Event Timeline: A visual, horizontal track running alongside or beneath the canvas. Users can drop "Event Nodes" across time, which are tethered directly to location pins on the Geography Canvas. Each event node accepts varied evidence or narrative context, such as text concepts, recorded audio descriptions, or uploaded reference photos.
The Character Vault: A dedicated inventory sidebar where users catalog the primary and secondary entities of their universe. It houses character text descriptions, personality profiles, and uploaded visual character references to ensure that any entity retains its exact visual identity whenever they are deployed into a scene.
The Agentic Creative Copilot: A proactive AI assistant embedded directly within the workspace. Unlike standard chatbots that just offer suggestions, this copilot listens to the team's brainstorming discussions or chat logs, actively spots logical inconsistencies or narrative plot holes, and can programmatically update the timeline, canvas, and layout configurations autonomously based on conversational feedback.
The Multi-Sensory Export Terminal: A versatile rendering bay allowing teams to grab sections of their timeline (or the entire story) and instantly convert them into consumer-ready media formats, including sequential storyboards, smooth animated animatic video clips, or localized multi-voiced dialogue audio scripts.

🔄 How the Features Interact
The magic of sagasandbox lies in its cross-component harmony. No feature operates in a silo:
Geography $\leftrightarrow$ Timeline: Moving an event node along the chronological timeline alters the status of the master canvas map. Conversely, clicking a specific location pin on the map opens up every historical event that has occurred in that geographical quadrant over time.
Character Vault $\leftrightarrow$ Event Generation: When a user creates an event on the timeline and types, "Detective Vance corners the suspect," the system references the Character Vault profile for "Detective Vance." It automatically pulls his visual attributes and embeds him into the visual rendering generated for that specific timeline node.
Global Style $\leftrightarrow$ Real-Time Workspace: Changing the overall project configuration from "High Fantasy" to "Sci-Fi Noir" instantly cascades a aesthetic redesign across the entire app. The canvas sketches recalculate, the character profiles morph into sci-fi counter-parts, and all previously generated scene images regenerate to align with the new lighting, costuming, and environmental constraints.

🚶‍♂️ The User Lifecycle & Workflows
Step 1: Setting up the Sandbox
The team initializes a project. They name it, choose a "Dark Fantasy" setting, and opt for a "Cinematic, moody oil-painting" aesthetic style. This instantly skins their workspace and calibrates the underlying engine's creative parameters.
Step 2: Mapping the World
Users navigate to the Geography Canvas. One team member uploads a rough image outline of a kingdom map, while another uses the brush tools to draw a crude mountain range. Within seconds, the background of the canvas synthesizes a gorgeous, painterly mountain barrier over their sketches. They mark a pin on the map and label it "The Whispering Tavern."
Step 3: Building the Narrative Sequence
The team shifts focus to the Chronological Timeline. They add an Event Node at Frame 1 titled "The Mysterious Contract," linking it to The Whispering Tavern pin. They record a quick 10-second voice note describing an elf receiving a glowing parchment. The system processes the audio, reads the elven traits from their Character Vault, and crafts a beautifully consistent visual scene panel.
Step 4: Co-authoring with the Agentic Copilot
As the team plots out subsequent event nodes, they hit a narrative wall. They open the chat window and ask: "How did the elf get the parchment if the gates to the tavern were locked at midnight?" The Agentic Copilot reviews the entire timeline, identifies the structural plot hole, and suggests a solution: "We can add a secret passage node under the tavern map at 11:30 PM." The users agree, and the AI agent automatically spawns the new event node on the timeline and updates the canvas geography layout seamlessly.
Step 5: The Master Export
Satisfied with their storyboarded arc, the team highlights a sequence on the timeline. They select "Cinematic Video Export." The platform takes the static scene panels, introduces fluid motion based on the text context, overlays ambient background fantasy audio tracks, and compiles a seamless video file ready to be shared with stakeholders, production crews, or audiences.


## Product Requirements Document
# PRD: SagaSandbox - Agentic Multimodal Storytelling Canvas

## 1. Executive Summary
SagaSandbox is a real-time, collaborative environment designed to unify creative world-building, forensic reconstruction, and narrative planning. By bridging the gap between abstract brainstorming and cinematic visualization, it allows teams to iterate on stories and crime scenes within a "living universe."

## 2. Product Goals
* Provide a singular source of truth for narrative and spatial data.
* Enable high-fidelity real-time visualization of abstract concepts.
* Facilitate seamless, agent-assisted collaboration between multiple users.
* Achieve <100ms interaction latency for workspace responsiveness.

## 3. Target Audience & Use Cases
* Creative Teams/Writers: Rapidly iterate on lore, character design, and plot flow.
* Forensic Investigators: Objectively reconstruct crime scenes from testimony, minimizing subjective interpretation gaps between team members.

## 4. Feature Requirements

### 4.1. The Universe Initializer
* Functionality: Select project "Theme" and "Aesthetic Style" presets.
* Constraint: Global configuration must propagate across all canvas elements and character renders immediately.

### 4.2. The Living Geography Canvas
* Functionality: Multiplayer whiteboard for sketching/mapping.
* Integration: Real-time synthesis of sketches, user provided descriptions into high-fidelity imagery using fal.ai/flux.
* Spatial depth via fal-ai/depth-anything.

### 4.3. The Chronological Event Timeline
* Functionality: Horizontal track for "Event Nodes."
* Integration: Nodes link to specific Geography Canvas pins.
* Input types: Text, voice (via fal-ai/whisper), and reference photos.

### 4.4. The Character Vault
* Functionality: Inventory of entities with persistent visual identity.
* Integration: Uses fal-ai/flux with LoRA to enforce visual consistency across all generated scenes.

### 4.5. The Agentic Creative Copilot
* Functionality: Proactive analysis of team discussions.
* Capability: Identifies plot holes/logical inconsistencies and suggests/executes layout modifications.
* Guardrails: Must request user approval for destructive changes; full version history/undo support required.

### 4.6. The Multi-Sensory Export Terminal
* Output Formats: 
    * Cinematic video with audio (via fal-ai/kling-video or fal-ai/luma-dream-machine).
    * Narrative scripts and dialogue documents.

## 5. Technical Specifications

### 5.1. Tech Stack
* Rendering Engine: fal.ai ecosystem (Flux, LoRA, Kling/Luma, Whisper, Depth-Anything).
* Backend/Database: Supabase (Data persistence/auth).
* UI/Frontend: Vercel V0-generated components.

### 5.2. Concurrency & Data Persistence
* Multiplayer Logic: First-come-first-served (last edit wins).
* Persistence Schema: Destructive by default, with mandatory "Version Revert" functionality (snapshotting).
* Security: Local-first asset storage; data privacy prioritized.

### 5.3. Latency Requirements
* End-to-end event processing: <100ms for UI updates.
* Rendering performance: Dependent on fal.ai inference times; localized UI must remain fluid.

## 6. Constraints & Buildathon Strategy
* Timeline: 24-hour development cycle.
* Resource Management: Strict optimization of fal.ai, Supabase, and Vercel credits. 
* Implementation Policy: Prefer open-source tooling for auxiliary functionality to preserve proprietary credit budget for core rendering.

## 7. Versioning & Recovery
* The platform must maintain a circular buffer of project states.
* Users must be able to view a "History Sidebar" to revert the canvas and timeline to any previous state generated during the session.

## Technology Stack
# TECHSTACK: SagaSandbox

## 1. Executive Summary
SagaSandbox is designed for high-concurrency, low-latency collaborative storytelling. Given the 24-hour Buildathon constraint, the stack prioritizes rapid development, integration with the Fal.ai ecosystem for generative media, and real-time state synchronization via Supabase.

## 2. Core Infrastructure & Backend
- Hosting & Deployment: Vercel (for rapid deployment of Next.js app and V0-generated components).
- Database & Auth: Supabase (PostgreSQL for structured event data, character profiles, and version history).
- State Management: TanStack Query (React Query) for server state; Zustand for local workspace UI state.
- Real-time Sync: Supabase Realtime (Broadcast & Presence) to manage the \"last-edit-wins\" multiplayer architecture.

## 3. Generative Media Engine (Fal.ai Stack)
All media synthesis is handled via asynchronous API calls to Fal.ai with a target latency of <100ms for UI-level refreshes.
- Scenery Generation: fal-ai/flux (Real-time Canvas-to-Image generation based on user sketch inputs).
- Identity Consistency: fal-ai/flux with LoRA (Training/Inference on-the-fly using Character Vault reference photos).
- Audio Intelligence: fal-ai/whisper (Converting voice notes to narrative metadata for Event Nodes).
- Motion & Export: fal-ai/kling-video or fal-ai/luma-dream-machine (Animatic video generation).
- Spatial Context: fal-ai/depth-anything (Converting 2D sketches/images into depth-mapped spatial environments).

## 4. Frontend & Creative Workspace
- Framework: Next.js 14+ (App Router).
- Language: TypeScript.
- Canvas Engine: Fabric.js or Konva.js (for high-performance 2D drawing, layer manipulation, and coordinate-to-pin mapping).
- UI Components: Shadcn/UI + Tailwind CSS (for rapid aesthetic deployment).
- Styling: A \"Presets\" engine that injects CSS variables globally when a user switches Themes (e.g., Cyberpunk vs. High Fantasy).

## 5. Agentic Logic (Creative Copilot)
- AI Orchestration: Vercel AI SDK.
- Model: GPT-4o or Claude 3.5 Sonnet (optimized for reasoning and identifying narrative plot holes).
- Logic Flow: The Copilot reads the `Events` and `Character` table from Supabase via context-aware prompts. Proposed updates are staged as \"Pending Transactions\" requiring user confirmation before being committed to the main database.

## 6. Data Integrity & Versioning
- Version Control: A `project_versions` table in Supabase. Every agentic or user action triggers a snapshot capture of the canvas state. 
- Undo/Redo: Implementation of a Command Pattern where every state transition stores the inverse operation in the local stack, allowing users to revert to any previous state index in the version history.

## 7. Media Export Pipeline
- Workflow: 
  1. Frontend gathers node metadata and visual assets.
  2. Assets are bundled and sent to a server-side FFmpeg worker (or Fal.ai video endpoint).
  3. Audio-Visual merging via FFmpeg (WASM or server-side).
  4. Final artifact delivery as an MP4 or JSON-formatted script file.

## 8. Development Constraints (24-Hour Buildathon Strategy)
- Prioritize Supabase Realtime for simple \"last-write-wins\" collision resolution.
- Use pre-built V0 components for the Character Vault and Timeline UI to save time.
- Mock non-critical backend services where possible; rely on Supabase's managed Postgres to avoid infrastructure overhead."

## Project Structure
# PROJECTSTRUCTURE: SagaSandbox

## Overview
The SagaSandbox project utilizes a modular, event-driven architecture designed for rapid development within a 24-hour Buildathon cycle. The folder structure prioritizes separation of concerns between the Agentic Copilot, the Canvas Rendering Engine, and the Data Persistence Layer.

## Directory Tree

/saga-sandbox
├── /src
│   ├── /components
│   │   ├── /Canvas          # Geography Canvas (React-Konva/Fabric.js)
│   │   ├── /Timeline        # Chronological event track UI
│   │   ├── /Vault           # Character Vault management UI
│   │   ├── /Copilot         # Chat interface and agent orchestration
│   │   └── /Exporter        # Multi-sensory export terminal UI
│   ├── /hooks               # Custom React hooks (useFal, useTimeline, useCollaboration)
│   ├── /services
│   │   ├── /ai-engine       # Fal.ai API integrations (Flux, Kling, Whisper, Depth-Anything)
│   │   ├── /persistence     # Supabase client and version control logic
│   │   └── /collaboration   # Real-time state handling (Last-Write-Wins logic)
│   ├── /lib
│   │   ├── /constants       # Global aesthetic presets & theme definitions
│   │   └── /utils           # Image processing and data transformation helpers
│   └── /types               # TypeScript interfaces for Project, EventNode, Character
├── /public                  # Static assets and UI icons
├── /server                  # Edge functions for sensitive API key orchestration
├── .env.example             # Environment variables (Fal API keys, Supabase credentials)
└── package.json

## Key Directory Explanations

### /src/services/ai-engine
This is the core of the project. It maps the user's intent to specific Fal.ai models. 
- **flux.ts**: Handles real-time canvas synthesis and character-consistent LoRA rendering.
- **whisper.ts**: Processes voice-to-text narrative descriptions for event nodes.
- **video-engine.ts**: Orchestrates Kling/Luma calls for animatic generation.
- **depth.ts**: Implements Depth-Anything to provide spatial awareness to 2D sketches.

### /src/services/persistence
Manages the "Destructive with Reversion" data model. Every user action triggers a state save to Supabase. To ensure the 24-hour goal, we utilize a simple JSON snapshot approach: every update generates a new record, allowing the UI to traverse the `version_history` table for instant reverts.

### /src/components/Copilot
Contains the logic for the Creative Agent. It monitors inputs and interacts with the project state. It is programmed to present a 'Pending Change' UI element—requiring a user confirmation click before the agent performs any large-scale automation or updates to the Timeline/Canvas.

### /src/services/collaboration
Implements the "Last-Write-Wins" ideology. Since the project targets a 24-hour build, we use a simple mutex-like flag in the project state. If two users edit the same node, the latest timestamped event broadcasted to the Supabase database overwrites the previous state, ensuring UI consistency without complex conflict resolution algorithms.

## Data Flow Logic
1. **User Action:** UI captures event (e.g., drawing on canvas).
2. **Local State:** Component updates immediately for sub-100ms latency.
3. **Persistence:** State is pushed to Supabase via edge functions.
4. **AI Generation:** The Ai-Engine triggers an asynchronous call to Fal.ai; once the image/video is generated, the resulting asset URL is pushed to the Project state, causing the Canvas/Timeline to re-render.

## Critical Technical Constraints
- **Security:** All assets are bucket-stored in the user's connected Supabase instance, ensuring data privacy.
- **Performance:** Rendering logic is optimized to use cached LoRA weights on Fal.ai to maintain high speeds. 
- **Versioning:** A `project_snapshots` table acts as the source of truth for the undo/revert functionality.

## Database Schema Design
## SCHEMADESIGN: SagaSandbox Database Architecture

The SagaSandbox database is designed for high-concurrency, collaborative narrative building, utilizing a relational model (PostgreSQL) optimized for state-based versioning and asset referencing.

### 1. Core Entity Relationship Model

- **Projects**: The root container for a narrative universe.
  - `id`: UUID (Primary Key)
  - `owner_id`: UserID
  - `name`: String
  - `theme_config`: JSONB (Stores selected style presets: e.g., { "aesthetic": "photorealistic", "tone": "noir" })
  - `created_at`: Timestamp

- **Geography_Nodes (Canvas)**: Represents locations, markers, and topographical data.
  - `id`: UUID
  - `project_id`: Foreign Key (Projects)
  - `geometry_data`: JSONB (SVG paths, coordinates, or reference image binary pointers)
  - `display_name`: String
  - `last_modified_by`: UserID

- **Character_Vault**: Maintains identity consistency.
  - `id`: UUID
  - `project_id`: Foreign Key (Projects)
  - `name`: String
  - `biography`: Text
  - `visual_reference_url`: URL (S3/Cloud Storage link to original character prompt/LoRA source)
  - `attributes`: JSONB (Tags for hair color, clothing, distinctive features for prompt injection)

- **Timeline_Events**: The narrative backbone.
  - `id`: UUID
  - `project_id`: Foreign Key (Projects)
  - `location_id`: Foreign Key (Geography_Nodes, nullable)
  - `timestamp_order`: Integer (Sequence index)
  - `description`: Text
  - `audio_summary`: Text (Output from Whisper)
  - `generated_asset_url`: URL (Link to the FAL.ai generated scene)

- **Event_Character_Map**: Junction table for character presence in specific events.
  - `event_id`: UUID
  - `character_id`: UUID

### 2. Versioning & State Persistence
To support the "Undo" and "Version History" requirements, we implement a snapshot pattern:

- **Project_Snapshots**:
  - `id`: UUID
  - `project_id`: Foreign Key
  - `state_blob`: JSONB (Full serialized state of Canvas + Timeline at a point in time)
  - `created_at`: Timestamp
  - `change_description`: Text (Generated by Copilot describing the change)

### 3. Agentic Copilot Integration
- **Agent_Logs**: Stores interactions for contextual awareness.
  - `id`: UUID
  - `project_id`: Foreign Key
  - `query`: Text
  - `response`: Text
  - `action_taken`: Boolean (Did it modify the database?)
  - `revert_reference_id`: UUID (Points to a Project_Snapshot ID to facilitate undoing AI actions)

### 4. Technical Implementation Notes
- **Latency Strategy**: The `JSONB` fields allow for rapid read/write of state configurations without intensive schema migrations.
- **Concurrency**: A `last_updated_at` column is present on all core entities. We utilize Optimistic Concurrency Control (OCC); when a save occurs, the application checks if the `updated_at` timestamp matches the initial state load. If a newer record exists (Last-Write-Wins), the UI alerts the user, but preserves the previous state in the `Project_Snapshots` table to ensure no data loss.
- **Asset Handling**: Database records do not store binary image/video data. They store reference pointers to hosted assets generated via FAL.ai and storage buckets.

### 5. Schema Interaction Workflow
1. **Scene Generation**: The system reads from `Timeline_Events` (description) and `Character_Vault` (attributes) $ightarrow$ Sends to FAL.ai $ightarrow$ Records result URL in `Timeline_Events.generated_asset_url`.
2. **Undo Action**: Triggered by user $ightarrow$ Reverts `Projects` and related tables to the data stored in the most recent `Project_Snapshot`.
3. **Multiplayer**: Updates are performed via atomic transactions. The application enforces a "Last-One-Saves" consistency model by verifying the row's `version` integer before commit.

## User Flow
# USERFLOW: SagaSandbox

## 1. OVERVIEW
The SagaSandbox user flow is built on a "living workspace" model where inputs from the Canvas, Timeline, and Vault are processed through the fal.ai orchestration layer to generate consistent, real-time visual and narrative outputs. The interaction design prioritizes low-latency feedback and bi-directional synchronization between spatial data (Geography) and temporal data (Timeline).

## 2. USER JOURNEY STEPS

### STEP 1: INITIALIZATION (UNIVERSE INITIALIZER)
- Trigger: User initiates a new project.
- Action: User selects from predefined "Theme & Style" presets (e.g., Cyberpunk Noir, High Fantasy).
- System Response: The system applies a global UI skin and configures the LoRA weights for the fal.ai/flux pipeline to match the aesthetic.
- Persistence: Project metadata saved to local state; project instance initialized in Supabase.

### STEP 2: WORLD MAPPING (LIVING GEOGRAPHY CANVAS)
- Interaction: User employs drawing tools (brush, shapes, text labels) on an infinite board.
- Processing: Strokes are captured by the canvas engine, processed via fal-ai/flux, and depth-mapped via fal-ai/depth-anything to render high-fidelity environmental backgrounds.
- Collaboration: Real-time sync; "Last-Edit-Wins" lock policy. If User A is drawing, User B sees the cursor and active transformation.
- Landmark Pinning: Users right-click to drop "Event Nodes" directly onto the map.

### STEP 3: NARRATIVE SEQUENCING (CHRONOLOGICAL TIMELINE)
- Input Methods:
    - Text: User types narrative description.
    - Audio: User records voice notes; processed via fal-ai/whisper to transcribe context.
- Linking: Event Nodes are anchored to specific spatial coordinates on the Geography Canvas.
- Logic: When a character is mentioned, the system performs a vector lookup in the Character Vault to attach specific LoRA identities to the generated visual assets.

### STEP 4: AGENTIC COPILOT INTERACTION
- Trigger: User opens the Sidebar Chat.
- Interaction: Copilot analyzes the current state (Timeline + Canvas).
- Pattern: 
    - Copilot detects a logic gap (e.g., Timeline contradiction).
    - Copilot proposes a fix ("Shall I move this event or add a transition node?").
    - User clicks "Approve" (required for major structural changes).
- Versioning: Every Copilot-initiated change is logged in a "History Stack." Users can traverse this stack to revert to any previous state using undo/redo buttons.

### STEP 5: EXPORT (MULTI-SENSORY TERMINAL)
- Selection: User selects a range of Event Nodes on the Timeline.
- Transformation: 
    - Visuals: Scenes rendered via fal-ai/flux.
    - Motion: Scenes animated via fal-ai/kling-video or fal-ai/luma-dream-machine.
    - Audio: Generative soundscapes/dialogue triggered.
- Output: User chooses between "Storyboard PDF," "Animatic MP4," or "Text Script."

## 3. WIREFRAME & COMPONENT DESCRIPTION
- Left Sidebar (Character Vault): Displays card-based profiles with visual thumbnails and descriptive traits.
- Top Bar (Global Controls): Project settings, Theme switcher, Export trigger.
- Center (Primary Workspace): Split-view toggle between Geography Canvas (2D/3D map) and Chronological Timeline (Horizontal flow).
- Bottom Right (Copilot Chat): Interactive chat window for structural feedback and autonomous editing.

## 4. INTERACTION PATTERNS
- Drag & Drop: Use to move Event Nodes on the timeline; system updates the timestamp metadata in real-time.
- Click-to-Pin: Interaction between canvas and timeline is bi-directional; selecting a pin highlights the timeline node and vice versa.
- Latency Management: <100ms UI responsiveness achieved via local state caching; heavy image generation tasks are offloaded to background workers with progress-bar status indicators.
- "Last-Edit-Wins" Protocol: To prevent cross-collaboration conflict, the system maintains a timestamped lock. If two users edit the same node simultaneously, the final broadcasted write command from the server takes precedence.

## 5. REVERSION AND VERSIONING
- Every significant state change is captured as a "Snapshot."
- The "Undo" stack allows step-by-step reversal of both manual user actions and AI agent edits.
- All local user assets (images, voice files) remain local-first in the user's browser session or local device cache as per privacy requirements, with minimal necessary metadata synced to the cloud for multiplayer collaboration.

## Styling Guidelines
STYLING GUIDELINES: SAGASANDBOX

1. DESIGN PHILOSOPHY: THE "UNOBTRUSIVE CANVAS"
SagaSandbox is a tool for creators, not a display of UI complexity. The interface must remain "low-chroma" to ensure the user’s creative output (the lore, maps, and generated art) remains the focal point. The UI should feel like a professional creative studio—utilizing a dark-themed, high-contrast environment that minimizes eye fatigue during long creative sessions.

2. COLOR PALETTE: THE STUDIO DARKROOM
We utilize a monochromatic base to allow the user’s generated content (which may be vibrant or neon) to pop against the interface.
- Primary Background: #0F0F12 (Deep Obsidian)
- Secondary Background (Panels): #1A1A1E (Matte Charcoal)
- Accent (Action/AI Focus): #7C3AED (Electric Violet) - Used for Copilot interactions and active state indications.
- Success/Confirm: #10B981 (Emerald Green)
- Warning/Undo: #F59E0B (Amber Gold)
- Text (Primary): #E5E7EB (Off-White)
- Text (Muted): #9CA3AF (Cool Grey)

3. TYPOGRAPHY: CLARITY AND PRECISION
Typography must be highly legible at small sizes for timeline labels, yet elegant for creative headers.
- Primary Font: Inter (Sans-Serif). Highly legible, clean, and modern. 
- Data/Timestamp Font: JetBrains Mono. Used for coordinates, timeline intervals, and technical logs to maintain a structural, "forensic" feel.
- Scaling:
  - H1 (Project Title): 24px/Semi-Bold
  - Body: 14px/Regular
  - Labels: 12px/Medium/All-Caps (Tracking: 0.05em)

4. UI/UX PRINCIPLES
- First-Come, First-Served Interactivity: Since SagaSandbox is a collaborative space, inputs are locked on a "last-save wins" basis. To prevent confusion, the UI must provide immediate visual feedback (a subtle outline color change) when an object is being locked or modified by a collaborator.
- Agentic Transparency: The Creative Copilot’s suggestions appear as "Ghost Nodes" on the timeline. These nodes are semi-transparent (#9CA3AF with 50% opacity) until the user clicks "Approve." Once approved, they shift to full opacity.
- Version History Access: A "Time-Travel" scrubber exists at the top right of the viewport. Sliding this allows users to see the state of the sandbox at any previous moment, enabling a visual "Undo" for both user and AI-driven changes.
- The "Sandbox" Metaphor: All tools should be accessible via a floating toolbar that remains pinned to the bottom of the Geography Canvas. This keeps the center of the screen reserved for the high-fidelity Fal.ai outputs.

5. DYNAMIC AESTHETIC INTEGRATION
Because the workspace changes based on the "Theme" (e.g., Cyberpunk vs. High Fantasy), the global UI theme is slightly adaptive:
- Cyberpunk Mode: Increases the saturation of accent glows and adopts sharper, angular container corners.
- High Fantasy Mode: Softens the container edges with a subtle 2px border-radius and shifts the UI accent color from Electric Violet to a more muted, regal Bronze (#B45309).

6. FEEDBACK & LATENCY VISUALS
Given the <100ms latency target, the UI must handle "Generation States" gracefully:
- Skeleton Loading: When Fal.ai is processing an image/map, use a low-frequency pulse effect on the target area.
- Progress Cursors: Use a mini-spinner near the user's cursor when they drop a new "Event Node" to show that the system is processing the narrative-to-visual link.
- Error Handling: If an agentic change fails, the border of the affected node glows soft Red (#EF4444) with an "Auto-Resolve" tool-tip for a quick retry."
