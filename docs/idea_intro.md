ShiftWorld Product Requirements and Execution Plan
Version 2 | October 11 2026 | Owner Irfan Firosh | Stack agnostic
1 Product decision
Build a warehouse decision rehearsal application populated by independent operational agents. Drivers, dispatchers, dock leads, crew leads, yard controllers and maintenance staff communicate, negotiate commitments and execute permitted actions. The shared engine owns physical state, reservations and time. A supervisor sets policy and resolves escalations but does not make every decision.
The visual target is simple blocky 3D, comparable to Roblox at its lowest graphics setting. Use recognizable freight vehicles, a large warehouse, dock doors and marked parking. Photorealism, detailed people, textures, shadows and cinematic animation are unnecessary. Physical capacity and operational causality must remain legible even when geometry is simplified.
This document replaces the earlier small terminal and optional multi-agent scope. It specifies an execution order, logical contracts, failure behavior, evidence requirements and acceptance criteria without prescribing languages, frameworks, databases or rendering libraries. NVIDIA inference through Nebius remains the intended agent runtime integration; model identifiers, pricing and submission rules must be checked against current official documentation before configuration.
The release is a simulator grounded in published facility specifications. Real warehouse operating accuracy requires additional site-specific evidence. It must not claim to reproduce Amazon's private scheduling policies, staffing organization or actual outcomes.
2 Changes from the earlier plan
Area
Version 2 requirement
Agents
Distributed agents are required in the first operational release
Authority
Agents execute local actions through the engine; supervisor handles exceptions
Agent population
Generated from documented or explicitly supplied operational records; no default total of 80
Facility
DFW Commerce Center Building I is the reference for physical capacity
Vehicles and staffing
Previous default counts are removed and remain unknown until evidenced
Rendering
Blocky geometry and flat colors are sufficient
Evidence
Each operational number carries source, unit, date and interpretation
Evaluation
Recorded workload, shared information opportunities and declared mechanics govern comparisons
Graphics work
Can proceed with an empty facility while operational data is incomplete

3 Users and operating questions
The intended user is a terminal supervisor or operations analyst examining how a shift responds to disruption. The hackathon audience must be able to identify a bottleneck, inspect decisions and understand their consequences without knowing warehouse software.
Support questions about an unavailable dock, an arriving shipment that blocks an outbound load, missing equipment, a delayed driver and conflicting resource requests. Present results as outcomes within the configured environment. Before claiming real-user usefulness, show the workflow to an operations practitioner and record corrections to the modeled rules.
A user must be able to load a facility profile, inspect its evidence, load an operational workload, run the shift, inject a clearly labeled hypothetical disruption, inspect agent interactions, branch from a checkpoint and export the recorded evidence.
4 Facility evidence and data policy
4.1 Physical reference
The property specification page identifies DFW Commerce Center Building I at 2601 South Airfield Drive, Irving, Texas, as leased to Amazon. These are published property specifications retrieved October 11 2026. The page is not an audit of current occupancy or operations. Source S1 applies only to Building I; values from adjacent buildings must not enter this profile.
Field
Published value
Interpretation
Gross building area
1,000,584 square feet
Published floor area
Dock-high doors
182
Physical capacity, not trucks present
Dock door size
9 by 10 feet
Published opening dimensions
Ramped doors
4
Separate from dock-high doors
Ramp door size
12 by 14 feet
Published opening dimensions
Trailer parking
235 spaces
Capacity, not inventory
Automobile parking
572 spaces
Capacity, not staffing
Building depth
600 feet
Published typical depth
Clear height
40 feet
Clear height, not total exterior height
Typical column spacing
56 by 60 feet
Published typical spacing
Site area
57.43 acres
Published property area
Building dimensions
1,642 by 600 feet with 720-foot-wide end bays at office entries
Preserve the stated exception
Truck court
135 feet plus 50 feet of trailer parking, total 185 feet
Published court composition

The headline dimensions do not alone specify the entire building outline. Do not multiply the rectangular dimensions and overwrite the separately reported floor area. Future parking expansion listed on S1 is excluded. The source provides a cross-dock building configuration, which describes physical loading access; it does not prove the current tenant uses the precise cargo-transfer process implemented by ShiftWorld.
4.2 Unknown operational fields
Daily truck visits, time-of-day arrivals, trailer occupancy, forklifts, yard tractors, workers per shift, crew composition, carrier count, dock direction assignments, service durations, transfer routes, gate capacity, movement speeds and operating priorities are unknown for this facility from the reviewed sources. The application must not fill them with earlier proposed values.
DEN8's reported fleet of more than 225 hydrogen-powered forklifts in December 2023 belongs to a different Amazon facility. Keep it in the research appendix as evidence that a site-specific count can be documented, not as a DFW parameter. Fueling capacity for up to 400 forklifts is also not an inventory count. Source S2.
4.3 Evidence record
Each numeric input stores field name, value or lower bound, unit, facility identifier, source URL or imported record, publication or observation date, retrieval date, evidence classification, interpretation and any calculation. Preserve qualifiers such as more than, approximately, planned and capacity. Source corrections create a new profile version without rewriting earlier runs.
Classifications are published specification, observed operation, user-supplied operation, derived conversion, hypothetical intervention and unknown. User-supplied values describe that user's scenario unless independently verified for DFW. Derived conversions retain the original and formula. Never infer worker counts from automobile spaces or visits from dock capacity.
The numerical configuration screen shows missing required fields. An empty facility can render and be inspected. Operational execution remains unavailable until the selected operation has the required workload and resource records. Importing another documented facility requires a separate profile; it cannot silently supplement DFW's unknowns.
4.4 What can be chosen without external evidence
UI colors, camera settings, agent software roles, message schemas, retry budgets and rendering limits are product decisions. They must be described as application configuration rather than measured Amazon facts. Agent role names do not establish Amazon's actual organization. A smaller selected operating area must be labeled a modeled subset, with explicit boundaries and resource coverage.
Hypothetical disruptions are permitted because this is a rehearsal product. The operator selects their magnitude and timing; the interface labels them as injected events. Baseline operating numbers remain sourced. Test fixtures use small declared synthetic examples solely to verify software and must not appear as real facility data.
5 Release scope
Required features are evidence-backed facility configuration, separate vehicles and shipments, authoritative state, multiple operational agents, structured messaging, atomic commitments, a simple 3D scene, disruption controls, agent inspection, event history, checkpoint replay, fair comparison and export.
Defer realistic skins, individual hand movements, voice, real carrier calls, live enterprise writes, robotics physics, detailed picking and packing, multi-facility networks and individual worker cognition. Free assets are optional appearance references. Procedural cuboids are an acceptable first visual implementation.
A facility profile is usable before it is operationally complete. The first engineering milestone can therefore be the sourced physical scene and evidence inspector. The first operational milestone depends on obtaining workload and resource data, rather than on inventing a default shift.
6 Main user journeys
6.1 Configure and inspect
Choose the DFW profile and view the source beside each property. Inspect which capacities are known and which resources have no verified count. Import resource and workload records, map columns and preview validation errors. Save the validated profile and workload as immutable versions.
6.2 Run and disrupt
Start the workload and view arrivals, admissions, trailer movements and service events. Pause to inspect a driver, dock or agent. Inject a disruption into an identified resource using declared start and end times. Show its hypothetical status in the event log. Agents receive only the relevant observations and messages.
6.3 Inspect a commitment
Select a accepted assignment to view the initiating agent, participants, resource reservations, dependencies, expiry and successful engine action. Inspect declined offers and failed validation separately. A spoken or written promise without a committed record does not reserve capacity.
6.4 Branch and compare
Create a checkpoint containing engine state, message delivery queues, agent memories and workload cursor. Create a new branch with a different controller or supported operating policy. Compare only branches with matching input versions, checkpoint, disruption script and reporting horizon. Show incompatible branches with reasons rather than a misleading ranking.
6.5 Export
Export the facility evidence, workload provenance, engine configuration, model configuration, action records, agent messages, checkpoints and metrics. A recipient must be able to distinguish recorded facts, hypothetical interventions and simulated results without reading this PRD.
7 Canonical information model
Entity
Required information
Facility profile
Identity, known capacities, dimensions, evidence records, map version
Workload
Visit records, shipments, appointments, observed or supplied service inputs, provenance
Tractor unit
Identity, position, coupled trailer if any, movement state
Trailer
Identity, position, cargo, door state, readiness, reservations
Driver
Identity, visit, own constraints, observed ETA, accepted commitments
Shipment
Identity, quantity and unit, origin, destination, container, readiness, dependencies
Dock
Identity, compatibility, direction when configured, occupancy, availability
Worker
Identity or documented aggregate count, skills, shift availability, allocation
Handling equipment
Identity, type, availability, task, supported load constraints
Agent
Role, local observations, memory, inbox, permissions, current commitments
Message
Sender, recipient, purpose, payload, sent and delivery times, causation IDs
Commitment
Participants, task, reservations, preconditions, expiry, state, version
Event
Logical time, sequence, type, affected IDs, state version, causation
Run
Versions, controller, input manifest, checkpoint, action trace, reporting horizon

Separate trailer, tractor, driver, shipment and visit IDs. A detached trailer can remain after a driver leaves. Cargo resides in a specific container or staging location and is conserved across transfers. Unknown information is represented explicitly and cannot be converted to zero.
8 Distributed agents
8.1 Population and authority
Multi-agent operation is required. Create driver identities from actual workload visits when the driver mapping is available. Create carrier identities from carrier records. Facility roles are configurable software abstractions whose coverage is recorded; their count is an implementation choice, not an Amazon staffing claim. No count is fixed to the earlier proposal of 20 facility agents or 80 total agents.
For the initial operational loop, instantiate agents representing drivers and at least two distinct facility responsibilities such as dock allocation and yard movement. They must have different observations or permissions and make consequential choices. Continue adding roles only when the selected data and workflow give them useful independent decisions.
Role
Local view
Permitted decisions
Driver
Own cargo, appointment, constraints and delivered instructions
Report ETA, request appointment, accept or decline feasible offers
Carrier dispatcher
Its visits and driver updates
Propose appointment swaps and coordinate commitments
Dock lead
Assigned doors, queue and received readiness reports
Offer dock windows and request handling resources
Crew lead
Documented workers, skills and allocations
Offer crew capacity and accept supported tasks
Yard controller
Assigned parking, lanes and movement resources
Offer parking and trailer moves
Gate agent
Arrivals, admission criteria and reported yard capacity
Validate check-in and admit or hold a visit
Maintenance agent
Reported faults, repair status and equipment availability
Declare outage status and request supported repairs
Outbound planner
Shipment readiness and configured route deadlines
Request missing freight and propose load or departure changes
Supervisor
Escalations, supported policy and permitted summaries
Resolve priority disputes and authorize policy exceptions within hard rules

8.2 Independence and memory
Each agent stores a role definition, goals tied to configured operational records, observable facts with timestamps, received messages and current obligations. Agent memory persists through pause and recovery. It must not contain future events or undisclosed global state. Changed observations do not erase earlier promises; the agent must cancel or renegotiate them through a tool.
Goals can conflict: a driver protects its departure target while a dock lead seeks productive use of doors. Goals and weights are declared application policy unless backed by actual operating records. Avoid personality traits that change physical productivity without evidence.
8.3 Interaction rules
Allowed communications are request, offer, accept, decline, cancel, status update and escalation. Every message has structured fields; a short readable explanation is optional. Send to relevant counterparts rather than broadcasting the whole world. A message cannot directly modify physical resources.
Agents activate on arrivals, received messages, resource failures, approaching configured deadlines, expired offers and changed dependencies. Routine motion uses the engine. Runtime budgets for calls, messages and negotiation rounds are explicit software settings. Reaching a budget produces an observable escalation or fallback; it cannot fabricate agreement.
Artificial Societies motivates individual state and connected interactions. Its commercial social-evaluation findings are not evidence of ShiftWorld's warehouse behavior. Our role network is an adaptation of the published principle, not a reproduction of its proprietary architecture. Source S3.
9 Negotiation and commitments
A request identifies task, required resources, relevant constraints, requested interval and state version. Counterpart agents can return alternatives with specific validity and expiry. Acceptances express intent. The engine checks all participants and atomically converts a complete accepted offer into a committed allocation.
Commitment states are proposed, accepted by some participants, ready for validation, committed, executing, completed, cancelled, expired and rejected. Only committed or executing commitments hold resources. Cancel before execution releases reservations; cancel during service invokes the declared interruption rule.
The engine rejects stale versions, incompatible docks, excess resource demand, missing cargo and overlapping commitments. Agents receive structured reasons and may revise. A rejected proposal does not alter physical state.
Use stable transaction IDs and request IDs. Duplicate retries return the previous result. Simultaneous contenders cannot both obtain the same exclusive resource. Resolve scheduling order deterministically, record the winner and let the losing agent renegotiate.
Deadlocks must be detectable as cycles or repeated lack of progress among resource requests. Do not keep partially accepted offers holding unrelated resources indefinitely. Offers expire; unresolved cycles escalate to the supervisor or the declared deterministic fallback. The fallback remains subject to the same invariants.
10 Logical tool contracts
Tool family
Contract
Observe
Read allowed entities at a stated logical time and version; unknown fields remain unknown
Message
Send structured payload to an authorized recipient and persist delivery status
Request and offer
Create candidate task windows without allocating resources
Accept and decline
Record participant intent against a specific offer version
Commit
Atomically validate and reserve all required resources with idempotent request ID
Execute
Begin supported action only when preconditions and reservations are valid
Cancel
Apply the configured interruption or cancellation rule and record released resources
Escalate
Package conflict, participants, evidence and unresolved choices for the supervisor
Plan and forecast
Generate or evaluate feasible candidates using permitted current information
Inspect evidence
Return source records for operational fields without providing hidden future workload

All mutation responses include success or rejection, reason code, affected IDs, resulting version and event IDs. Tool access is scoped to the role and operating area. LLM text never executes as an arbitrary program or direct state patch. Tools are logical contracts; implementations may use any appropriate stack.
Scheduling algorithms remain shared tools. They calculate candidate schedules under declared constraints; agents determine which requests to make, gather information and coordinate agreement. The supervisor's policy does not bypass participant authority or hard capacity rules.
11 Engine mechanics
11.1 Movement and service
The engine maintains a logical clock and a stable event order. Rendering interpolates between recorded positions and cannot decide completion. Movement requires configured paths, durations or speeds; service requires configured work quantities and productivity. Required fields without evidence block the relevant operation instead of silently receiving a plausible value.
Truck states include not arrived, awaiting admission, admitted, maneuvering, waiting for service, serving, paused, ready to depart and departed. Trailer states also include detached parking and yard movement. The engine controls coupling and uncoupling explicitly. Agents authorize tasks while predefined mechanics carry out routine execution.
11.2 Hard rules
Each trailer has one physical location. Each tractor couples to at most one trailer. A dock hosts at most one trailer. A worker or equipment item cannot be allocated to overlapping tasks. A parking space cannot contain multiple trailers. Movement follows connected permitted paths and releases lanes when complete.
Cargo transfers conserve quantity and require compatible destination capacity. Departure depends on the configured readiness criteria. Partial loading remains recorded after interruption. Deadlines are measured outcomes unless the imported operating policy makes them a hard condition.
11.3 Disruptions
Dock closure prevents new assignments and pauses affected service. An occupied trailer stays at the dock until a supported relocation is explicitly executed; cargo cannot teleport. Worker and equipment allocations are released only when the declared safe interruption process allows it. The initial simulator pauses time while agents decide and reports inference latency separately.
Worker absence changes availability according to the configured record or injected intervention. Identify which tasks lose required capacity; never let a lead invent substitute skills. Equipment failure marks its task interrupted and requires resource reassignment. A delayed arrival changes the appropriate visit ETA; dependent departures update only after actual readiness is recalculated.
Disruption recovery is an event: repaired equipment or reopened doors become available at the configured time. Restarting service reacquires required resources and preserves remaining work. These mechanics are product rules requiring practitioner validation, not claims about Amazon procedures.
12 Simple 3D rendering requirements
Render a warehouse shell, numbered doors, trailer parking markers, tractor units, box trailers and handling equipment using basic geometry. Use muted gray buildings, light trailers, darker tractors and distinct status outlines. Use one basic lighting setup; textures and shadows can be disabled. Low polygon count describes geometry complexity and does not require cartoon proportions.
The physical profile contains exactly 182 dock-high door identities, four ramp-door identities and 235 trailer-space identities. Their precise coordinates and assignment to building sides are unknown until a site plan is traced. An early diagram or scene must carry a persistent schematic-layout label. Do not invent a split of 91 doors per side or an inbound/outbound ratio and call it surveyed.
The application may cluster distant doors and parking into groups for readability while retaining exact entity counts. Selection exposes underlying identities. Group rendering is a visual abstraction, not a reduction in capacity. Automobile spaces may be represented as labeled background capacity unless a verified site map is available.
Vehicle dimensions and forklift models must be sourced from manufacturer information or retained as appearance-only proxies. An imported asset's proportions do not verify actual equipment at the facility. Geometry shall not change service capacity, travel speed or loading duration.
Required interactions are orbit or fixed elevated view, zoom, pan, select, roof toggle and reset camera. Selection works from the scene and tables. Status must also appear in text. Avoid speech bubbles over every truck; show interactions for selected agents or active exceptions.
Optional free assets from the research are listed in the appendix. Begin with primitives so downloads, conversion and texture cleanup cannot block the agent loop. Later replace meshes behind the same entity bindings. Agent decisions and events continue to work with graphics disabled.
13 Dashboard requirements
The top bar shows profile, workload, run mode, logical time and evidence status. Provide pause, next event, speed controls, checkpoint and compare. Speed changes display pacing, never physical outcomes.
The central scene shows the simplified facility. The left panel lists capacities, actual configured resources, queues and unknown fields. The right panel shows selected agent observations, inbox, obligations and recent executed actions. A bottom timeline connects messages, commitments, disruptions and physical events by IDs.
Display capacity, occupancy and throughput as separate values. For example, trailer spaces total 235 while occupied spaces remain unknown until a workload or observation establishes occupancy. Before a run, show no measured result rather than a fabricated average wait. Indicate a paused decision interval and the software's pending agent work.
The commitment inspector shows participants, task, requested resources, acceptance status, reservations, expiry, reasons for rejection and committed outcome. The evidence inspector shows source, date, qualifier and facility scope. The dependency panel shows shipments holding up outbound work.
Compare views include waiting, lateness, cargo dwell, completed visits and invalid proposals, plus inference usage and fallback actions. Clearly identify simulated outcomes and hypothetical disruptions. Export includes exactly the information needed to audit the displayed values.
14 Replay and fair evaluation
Replay consumes recorded events and successful actions. It never recalls the model. A fresh agent rerun is a new branch that may produce different decisions. Checkpoints capture outstanding messages, offer expiry, reservations, agent memories, observations and the remaining exogenous workload.
Compare distributed agents with first-come scheduling, earliest-deadline scheduling and a centralized optimizer when applicable. Give controllers the same workload, resource constraints and information-acquisition opportunities. A centralized controller must not receive a future ETA that distributed agents must request. Record access differences if a controller cannot use the same mechanism.
Freeze operating inputs and disruption scripts before comparison. If productivity differs by resource or task, retain those fixed inputs across branches; do not change random draws merely because task order changes. Report controller behavior under stated engine mechanics. No controller is presumed superior.
Do not claim real-world predictive accuracy until recorded operational observations support a separate calibration study. An exact building capacity does not establish arrival patterns, task durations or human behavior.
15 Metrics and definitions
Metric
Definition and limitation
Completed visits
Visits that satisfy declared completion conditions by reporting horizon
Driver waiting
Sum of intervals in configured waiting states; separate road and yard stages
Trailer dwell
Time from recorded site entry to exit; report unfinished trailers as censored
Departure lateness
Positive difference between departure and configured target
Cargo dwell
Time in transfer or staging locations according to event records
Capacity utilization
Busy time divided by available capacity time; exclude outages in denominator
Invalid proposals
Rejected action requests, distinct from executed violations
Executed violations
Must remain zero under hard invariant checks
Coordination overhead
Messages, rounds and escalations per completed commitment
Inference usage
Recorded calls, tokens, measured latency and sourced pricing when available
Fairness of delay
Waiting by carrier or priority group using declared categories

Each displayed value links to event definitions, scope and reporting horizon. Do not average out censored unfinished work without disclosure. Missing deadlines disable lateness metrics. Missing cost pricing produces token usage without a fabricated monetary estimate.
16 Reliability and persistence
Persist inputs and engine versions before execution. Append events and commitment transitions durably. On restart restore the latest checkpoint and replay accepted actions once. A crashed pending model call may retry using the same action request identity; it must not duplicate a reservation or movement.
Model errors, malformed output and timeouts produce recorded failures. Use configured bounded retries followed by escalation or a declared deterministic controller. Label fallback ownership in the dashboard. Never fabricate messages or tool successes to keep an animation moving.
Pause or reject a run when essential evidence disappears or input validation fails. Losing a graphics context must not corrupt the engine. A disconnected dashboard reconnects by version and receives missed events. Provide export without the rendering layer.
Performance budgets are engineering settings measured on a recorded device and browser. Set acceptance thresholds after profiling the basic scene; do not invent benchmark results. Measure scene frame time separately from model latency and engine step time. Test full published capacity geometry with sparse and crowded supplied workloads.
17 Ordered implementation backlog
Phase A Evidence and configuration
Create the field registry, DFW physical profile and source records. Implement unknown values and qualified counts. Build import validation for visits, resources, shipments and task inputs. Identify missing operating evidence. Deliver an inspectable empty facility profile; operational start must explain unresolved requirements.
Exit when S1 values remain attached to their source and every unknown stays explicit through save, reload and export. Obtain a documented operational workload or user-supplied operating records before claiming an operationally grounded shift.
Phase B Engine and resource accounting
Implement IDs, event ordering, coupling, parking, dock occupancy, cargo location and atomic allocations. Build small synthetic fixtures for collision, capacity and cargo-conservation tests. Implement pause and recovery mechanics. Complete deterministic event replay before using agents.
Exit when retries cannot duplicate actions, conflicting allocations are rejected and interruptions preserve cargo and work. Fixtures are labeled synthetic and excluded from real-facility evidence.
Phase C Basic facility visualization
Build simple meshes and bind them to entity IDs. Represent every published door and parking identity even when visually clustered. Add selection, roof toggle and schematic labels. Wire evidence and missing-data panels. Profile on a recorded device before choosing graphics budgets.
Exit when selecting an entity exposes the same state as the engine and frame rate changes cannot alter results. Do not wait for polished free assets.
Phase D Distributed operational loop
Implement role-specific observations, permissions, memory and messaging. Start with driver, dock and yard responsibilities acting independently. Add structured offer and acceptance records, atomic commitments, expiry and escalation. Connect current NVIDIA inference through the intended provider after verifying its tool schema.
Exit when agents with different information negotiate and execute a valid change without every action being selected by the supervisor. Add crew, dispatcher and maintenance roles as the workload and resource data support their responsibilities.
Phase E Disruption and coordination inspection
Implement hypothetical dock closure, arrival delay and resource failure. Display affected commitments, rejected actions, dependency changes and fallback decisions. Make agent inspection and causal timelines readable.
Exit when an interruption leads to an observable valid response or explicit unresolved escalation, with no fabricated repair, staffing or completion.
Phase F Branching and evaluation
Capture complete checkpoints and reproduce logged runs. Add compatible baseline controllers and fair information access. Calculate metrics from events. Export provenance and comparisons. Record favorable and unfavorable agent outcomes.
Exit when changing controller is the relevant branch difference and replay reconstructs the committed state without model calls. Missing operational evidence remains a release limitation, not an invented fixture promoted to a case study.
Phase G Release preparation
Ask an operations practitioner to inspect mechanics and labels. Record feedback. Verify asset licenses and source records. Capture the working product and measured evaluation outputs. Recheck current hackathon rules, required inference integration and submission deadline before producing release material.
There is no fixed hour estimate or dated schedule in this revision. Estimate remaining work from completed milestones and actual build throughput. This respects the requirement to avoid unsupported numerical planning assumptions.
18 Acceptance catalogue
ID
Required observable outcome
E01
DFW profile contains exactly 182 dock-high doors, four ramp doors and 235 trailer spaces
E02
Every published number links to S1 with its unit and interpretation
E03
Future expansion does not increase base capacity
E04
Unknown operational values survive save and export as unknown
E05
DEN8 forklift evidence cannot configure DFW by default
E06
Operational start identifies required missing records
E07
Building-side assignments remain schematic until evidenced
A01
Agents have distinct observations and mutation permissions
A02
A driver and facility agents negotiate a consequential change
A03
Supervisor does not select every local action
A04
Message delivery, commitments and memory persist through recovery
A05
Future disruptions cannot enter current observations or forecasts
A06
Unsupported resource claims fail rather than create equipment
C01
Partial acceptances do not allocate exclusive resources
C02
Complete commitments atomically acquire all required resources
C03
Simultaneous requests cannot share an exclusive resource
C04
Duplicate request IDs do not duplicate committed actions
C05
Stale offers fail with a structured reason
C06
Expiry and escalation resolve or expose nonprogress
P01
Coupling and trailer movement preserve one physical location
P02
Cargo quantity and partial work survive interruptions
P03
Unavailable docks and equipment cannot accept new work
P04
Workers and equipment cannot serve overlapping tasks
P05
Configured movement and service inputs govern completion
V01
Simple geometry is sufficient to understand queues and occupied docks
V02
Scene and table selection resolve the same entity identity
V03
Rendering speed does not change event outcomes
V04
Unknown occupancy is not displayed as zero or full capacity
R01
Replay uses recorded actions without additional inference
R02
Checkpoint branches retain workload and hidden future events consistently
R03
Comparison blocks incompatible input versions or horizons
R04
Baselines have equivalent information-acquisition opportunities
R05
Export identifies provenance, interventions and simulated results
F01
Timeout or malformed output produces visible escalation or fallback
F02
Restart does not duplicate a service or reservation
F03
Graphics failure leaves engine records intact
L01
Every shipped third-party asset has retained license and attribution
L02
Public description distinguishes property grounding from operating calibration

The catalogue is a required engineering check list, not a set of claimed test results. Attach actual pass or fail evidence during implementation. Numerical examples used to exercise these checks belong to synthetic test fixtures.
19 Release risks and unresolved decisions
The largest dependency is missing operational data. Source collection must precede claims about realistic throughput, staffing or vehicle fleets. If DFW cannot supply sufficient public or user-provided records, retain its scene as a documented property reference and select a separate evidenced facility for operational evaluation. Obtain user agreement before changing the project reference.
Distributed negotiation may add latency without improving outcomes. Measure overhead and compare with a centralized controller. Limit chatter, narrow observations and keep actions structured. High agent identity counts should not imply continuous inference for each entity.
The large physical footprint may overwhelm a small screen. Use zoom, groups and inspection while preserving exact counts. Asset cleanup may consume implementation time; simple blocks are the accepted design. Schematic coordinates may look authoritative; persistent labeling is required until a site plan is traced.
Unresolved items are DFW operating records, verified site geometry and dock placement, equipment specifications, shift coverage, service mechanics, supported policy objectives and the provider's current inference configuration. The application must display these as open decisions rather than silently deciding them.
20 Diagram guide
The accompanying diagram pack contains five views: physical reference and unknown operations, the role interaction network, the validated commitment loop, checkpoint comparison and the main dashboard wireframe. They describe product architecture and layout intentions. The facility graphic is a schematic; it is not a surveyed map or a depiction of actual occupancy. Agent role boxes represent software responsibilities, not sourced staff counts.

Facility evidence and operating inputs


Distributed agent roles


Commitment execution


Replay and comparison


Simple dashboard wireframe


21 Free visual asset appendix
These are optional free listing candidates from the research. They have not been downloaded and tested together. Their presence does not verify equipment identity at DFW. The first release may use only original primitive geometry. CC BY candidates require attribution; preserve the exact license version at download. Do not redistribute an asset before checking its license.
Appearance
Candidate and license
Warehouse
Nicholas-3D Warehouse FBX Model Free, CC BY, source S5
American tractor
rudransh17feb American Semi Truck, CC BY listing, source S6
Detached trailer
Artbor Semi Trailer Low poly Animated, CC BY, source S7
Forklift
tasraven Forklift, CC BY, source S8
Cargo boxes
plaggy Cardboard Box Closed, CC0 and zero-dollar option, source S9
Yard surface
Poly Haven Asphalt 02, CC0, source S10
Handling floor
Poly Haven Concrete Floor, CC0, source S11
Lighting
Poly Haven Industrial HDRIs, CC0, source S12

A verified suitable free terminal tractor remains unresolved. Build a labeled basic proxy until a licensed candidate is confirmed. Flat colors can replace all textures. Adapt warehouse meshes to the sourced profile instead of adopting their arbitrary door count or footprint.
22 Source register
S1 DFW Commerce Center Features. https://www.dfwcommercecenter.com/features . Retrieved October 11 2026. Building I property specifications and master-plan summary. Page publication date not provided. Does not establish current operating inventory, precise coordinate survey or tenant process.
S2 Plug Power First Installation of Electrolyzer at Amazon Fulfillment Center. https://www.ir.plugpower.com/press-releases/news-details/2023/Plug-Power-Completes-First-Installation-of-Electrolyzer-at-Amazon-Fulfillment-Center/default.aspx . Published December 27 2023. DEN8 only. More than 225 forklifts; fueling capacity up to 400. Historical supplier report, not DFW evidence.
S3 Artificial Societies How Artificial Societies Are Built. https://societies.ai/knowledge/the-science-behind-artificial-societies . Published September 18 2026 and updated September 28 2026. Conceptual reference for individual personas connected through networks. Does not validate warehouse agents.
S4 Amazon Freight Cross Docking Guide. https://freight.amazon.com/newsroom/shipper-tips/26-cross-dock-101 . Published July 10 2026. General inbound-to-outbound transfer process. https://freight.amazon.com/newsroom/2023-what-is-drop-and-hook . Published March 2 2023. General distinction between live loading and drop-and-hook. Neither establishes DFW's operating process.
S5 https://sketchfab.com/3d-models/warehouse-fbx-model-free-daa7fd3ff88945298d00045ca40a4c03
S6 https://sketchfab.com/3d-models/american-semi-truck-11f3b663616a4ff5956a7d86a74c009a
S7 https://sketchfab.com/3d-models/semi-trailer-low-poly-animated-c40a3fb85f1c4d28a4c6c23710819c14
S8 https://sketchfab.com/3d-models/forklift-77a9000b8b584a16b739810fde725037
S9 https://plaggy.sellfy.store/p/cc0-cardboardboxclosed-3d/
S10 https://polyhaven.com/a/asphalt_02
S11 https://polyhaven.com/a/concrete_floor
S12 https://polyhaven.com/hdris/industrial and https://polyhaven.com/license
Asset listings were reviewed October 11 2026. Direct access to some Sketchfab pages was blocked; indexed creator listings provided availability and license information. Archive the actual license and inspect files before adoption. Source register numbers are references, not operational quantities.
