<?php
/**
 * People → Profile guide: the one-page editor guide for /people/{slug}/.
 * Plain admin markup (WordPress's own styles), no assets.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$invite = function_exists('si_profile_invite_block_id') ? si_profile_invite_block_id() : 0;   // schiller-editorial
$invite_edit = $invite ? admin_url('post.php?post=' . $invite . '&action=edit') : admin_url('edit.php?post_type=wp_block');
$new_talk = admin_url('post-new.php?post_type=si_presentation');
$people = admin_url('edit.php?post_type=si_person');
?>
<div class="wrap si-guide">
	<h1><?php esc_html_e('Profile guide', 'si'); ?></h1>
	<p class="si-guide__lead"><?php esc_html_e('Every person has a public profile page. The layout never needs changing: it fills itself from records you already keep, and each part appears only when there is something to show. This page explains what fills what.', 'si'); ?></p>

	<div class="si-guide__cols">
		<section class="card">
			<h2><?php esc_html_e('Filled in automatically', 'si'); ?></h2>
			<ul>
				<li><strong><?php esc_html_e('Recordings', 'si'); ?></strong> — <?php esc_html_e('every Presentation and Video that names the person as presenter or host.', 'si'); ?></li>
				<li><strong><?php esc_html_e('Conferences, “In the archive since”, the figures', 'si'); ?></strong> — <?php esc_html_e('from those recordings.', 'si'); ?></li>
				<li><strong><?php esc_html_e('The company kept', 'si'); ?></strong> — <?php esc_html_e('everyone else presenting at the same conferences.', 'si'); ?></li>
				<li><strong><?php esc_html_e('Writing & press, documents', 'si'); ?></strong> — <?php esc_html_e('statements they signed, coverage that features them, documents they wrote.', 'si'); ?></li>
				<li><strong><?php esc_html_e('Themes', 'si'); ?></strong> — <?php esc_html_e('the Topics of all of the above.', 'si'); ?></li>
				<li><strong><?php esc_html_e('A one-line biography', 'si'); ?></strong> — <?php esc_html_e('written from those facts until someone writes a real one.', 'si'); ?></li>
			</ul>
		</section>
		<section class="card">
			<h2><?php esc_html_e('Written by editors (all optional)', 'si'); ?></h2>
			<ul>
				<li><?php esc_html_e('Descriptor, Introduction, Offices held, Quotes — in the “Profile page” box on the person.', 'si'); ?></li>
				<li><?php esc_html_e('The biography — the person’s main text.', 'si'); ?></li>
				<li><?php esc_html_e('The portrait — featured image, with Photo licence filled in (without a licence it is never shown).', 'si'); ?></li>
			</ul>
			<p><?php esc_html_e('The “What the profile shows” box beside each person lists what is there and what is missing.', 'si'); ?></p>
		</section>
	</div>

	<h2><?php esc_html_e('The top of the page, line by line', 'si'); ?></h2>
	<div class="si-guide__hero" aria-label="<?php esc_attr_e('Diagram: which field fills which line', 'si'); ?>">
		<div class="si-guide__photo"><span>1</span><?php esc_html_e('Featured image', 'si'); ?></div>
		<div class="si-guide__text">
			<p class="si-guide__eyebrow"><span>2</span>STATESMAN &amp; SOLDIER · UNITED STATES · IN THE ARCHIVE SINCE 2014</p>
			<p class="si-guide__name"><span>3</span>Richard Black</p>
			<p class="si-guide__hon"><span>4</span><em>Col. (ret.) · former Virginia State Senator</em></p>
			<p class="si-guide__intro"><span>5</span>A combat veteran and conservative Republican who has used Schiller Institute platforms to argue against war…</p>
			<div class="si-guide__offices"><span>6</span><small>U.S. MARINE CORPS</small><br>Helicopter pilot · 269 combat missions</div>
			<p class="si-guide__quote"><span>7</span>▶ In the speaker’s own words · Jun 2022 · 1:07:12</p>
		</div>
	</div>
	<table class="widefat striped si-guide__table">
		<thead><tr><th>#</th><th><?php esc_html_e('On the page', 'si'); ?></th><th><?php esc_html_e('Where to enter it', 'si'); ?></th></tr></thead>
		<tbody>
			<tr><td>1</td><td><?php esc_html_e('Portrait', 'si'); ?></td><td><?php esc_html_e('Featured image + Photo licence (+ Photo credit). No licence, no photo: a monogram is shown instead.', 'si'); ?></td></tr>
			<tr><td>2</td><td><?php esc_html_e('Small capitals above the name', 'si'); ?></td><td><?php esc_html_e('Descriptor · Country · the year of the earliest linked talk (automatic)', 'si'); ?></td></tr>
			<tr><td>3</td><td><?php esc_html_e('Name', 'si'); ?></td><td><?php esc_html_e('The title of the person entry (+ Name in native script, shown under it)', 'si'); ?></td></tr>
			<tr><td>4</td><td><?php esc_html_e('Italic line', 'si'); ?></td><td><?php esc_html_e('Honorific', 'si'); ?></td></tr>
			<tr><td>5</td><td><?php esc_html_e('Large sentence', 'si'); ?></td><td><?php esc_html_e('Introduction', 'si'); ?></td></tr>
			<tr><td>6</td><td><?php esc_html_e('Offices', 'si'); ?></td><td><?php esc_html_e('Offices held, one per line: Organisation | Role. Empty: the Affiliation field is shown.', 'si'); ?></td></tr>
			<tr><td>7</td><td><?php esc_html_e('Play link', 'si'); ?></td><td><?php esc_html_e('A quote with “Use in the hero” ticked', 'si'); ?></td></tr>
		</tbody>
	</table>

	<div class="si-guide__cols">
		<section class="card">
			<h2><?php esc_html_e('Adding a talk', 'si'); ?></h2>
			<ol>
				<li><a href="<?php echo esc_url($new_talk); ?>"><?php esc_html_e('Presentations → Add New', 'si'); ?></a> <?php esc_html_e('(for a standalone webcast or interview: Videos → Add New, and use Host / speakers).', 'si'); ?></li>
				<li><?php esc_html_e('Title: the talk’s title.', 'si'); ?></li>
				<li><?php esc_html_e('YouTube video ID: the part after “watch?v=”.', 'si'); ?></li>
				<li><?php esc_html_e('Presenter(s): pick the person.', 'si'); ?></li>
				<li><?php esc_html_e('Conference: pick it, if the talk was given at one — this is what fills “The company kept”.', 'si'); ?></li>
				<li><?php esc_html_e('Optional: Start and End (in seconds) when the talk is part of a longer recording.', 'si'); ?></li>
			</ol>
			<p><?php esc_html_e('Publish. The person’s profile — and the profile of everyone at the same conference — updates by itself.', 'si'); ?></p>
		</section>
		<section class="card">
			<h2><?php esc_html_e('Adding a quote', 'si'); ?></h2>
			<ol>
				<li><?php esc_html_e('Open the talk on youtube.com; under the video click “…more”, then “Show transcript”.', 'si'); ?></li>
				<li><?php esc_html_e('Find a sentence (the transcript can be searched). Copy it, and note the time beside it, e.g. 1:07:12.', 'si'); ?></li>
				<li><?php echo wp_kses(sprintf(
					/* translators: %s: link to People */
					__('Open the person in %s → “Profile page” box → Add a quote: paste the sentence, choose the recording, type the time.', 'si'),
					'<a href="' . esc_url($people) . '">' . esc_html__('People', 'si') . '</a>'), ['a' => ['href' => []]]); ?></li>
				<li><?php esc_html_e('Fix capitals and punctuation (automatic captions have none). If you change a word, put it in [brackets].', 'si'); ?></li>
				<li><?php esc_html_e('Optional: a context line, and “Use in the hero” for the one quote that introduces the person.', 'si'); ?></li>
			</ol>
			<p><?php esc_html_e('About 5–10 minutes a quote. Quotes are worth it for the most prominent people; the page is complete without them.', 'si'); ?></p>
		</section>
		<section class="card">
			<h2><?php esc_html_e('Linking writing, press and documents', 'si'); ?></h2>
			<ul>
				<li><?php esc_html_e('A statement they signed: Statement → Signatories (SI people).', 'si'); ?></li>
				<li><?php esc_html_e('Press about them: Coverage → Featured SI people (and Outlet, which shows as a wordmark).', 'si'); ?></li>
				<li><?php esc_html_e('A document they wrote: Document → Authors.', 'si'); ?></li>
				<li><?php esc_html_e('An article they wrote: the People field on the post, once it is added.', 'si'); ?></li>
			</ul>
		</section>
		<section class="card">
			<h2><?php esc_html_e('The invitation at the bottom', 'si'); ?></h2>
			<p><?php esc_html_e('The “Be in the room” tile is one shared pattern: change it once and every profile changes.', 'si'); ?></p>
			<p><a class="button" href="<?php echo esc_url($invite_edit); ?>"><?php esc_html_e('Edit the invitation', 'si'); ?></a></p>
			<p><?php esc_html_e('Its button links to NationBuilder; set it to the sign-up page you want. When a conference has a Registration link and a start date in the future, the tile also offers it automatically.', 'si'); ?></p>
		</section>
		<section class="card">
			<h2><?php esc_html_e('Other languages', 'si'); ?></h2>
			<ul>
				<li><?php esc_html_e('Every language shows the same people. Descriptor, Introduction, Offices held, the biography and quote context lines are translated per language in WPML; until they are, the original shows.', 'si'); ?></li>
				<li><?php esc_html_e('Quotes stay in the language they were spoken. Add them on the original-language person.', 'si'); ?></li>
				<li><?php esc_html_e('Section names (“Life”, “Recordings” …) are translated in WPML → String Translation, text domain “si”. The invitation pattern is translated like any page.', 'si'); ?></li>
			</ul>
		</section>
	</div>
</div>
<style>
	.si-guide { max-width: 1100px; }
	.si-guide__lead { font-size: 15px; max-width: 70ch; }
	.si-guide__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin: 16px 0 24px; }
	.si-guide .card { max-width: none; margin: 0; }
	.si-guide .card li { margin-bottom: 6px; }
	.si-guide__hero { display: grid; grid-template-columns: 180px 1fr; gap: 28px; align-items: center; margin: 12px 0 16px; padding: 24px; background: #f6f6f3; border: 1px solid #dcdcde; font-family: Georgia, serif; }
	.si-guide__photo { position: relative; aspect-ratio: 4/5; display: grid; place-items: center; border: 1px solid #a08040; background: #e9edf1; font-family: sans-serif; font-size: 12px; color: #5c6570; }
	.si-guide__text { display: grid; gap: 8px; }
	.si-guide__text p, .si-guide__text div { position: relative; margin: 0; padding-left: 30px; }
	.si-guide span:not([class]) { position: absolute; left: 0; top: 2px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #1f4a73; color: #fff; font: 600 11px/1 sans-serif; }
	.si-guide__photo span { left: 8px !important; top: 8px !important; }
	.si-guide__eyebrow { font: 600 11px/1.3 sans-serif; letter-spacing: .12em; color: #5c6570; }
	.si-guide__name { font-size: 34px; line-height: 1.1; color: #121a24; }
	.si-guide__intro { font-size: 17px; color: #3d4550; max-width: 60ch; }
	.si-guide__offices { border-left: 1px solid #a08040; }
	.si-guide__offices small { font: 600 10px sans-serif; letter-spacing: .12em; color: #5c6570; }
	.si-guide__quote { font: 600 13px sans-serif; color: #1f4a73; }
	.si-guide__table { max-width: 900px; }
</style>
