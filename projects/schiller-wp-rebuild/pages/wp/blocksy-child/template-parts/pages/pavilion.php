<?php
/**
 * PAGE — "The Pavilion". Any WordPress Page, rendered on the server.
 *
 * A title band (the page's Featured image, or the Earth from space, fading
 * toward the title) with a card of the page's particulars; a sticky ribbon of
 * its sections; then each section as a full-width room with its heading on the
 * left wall and alternating grounds. Reads completely with JavaScript off; the
 * module only marks the section being read in the ribbon.
 *
 * @var array $args ['p' => si_pavilion_data()]
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

$p = $args['p'];
$band = $p['band'];
$rooms = $p['rooms'];
$single = count($rooms) === 1;
$numbered = !empty($rooms[0]['heading']) ? 1 : 0;   // an opening before the first heading carries no number
?>
<div class="si-page pa">
	<header class="pa-band<?php echo $band['kind'] !== 'none' ? ' has-photo' : ''; ?>">
		<?php if ($band['kind'] === 'photo') : ?>
			<figure class="pa-photo"><?php echo $band['img']; // wp_get_attachment_image() ?></figure>
		<?php elseif ($band['kind'] === 'earth') : ?>
			<figure class="pa-photo pa-photo--earth" style="--shape: url('<?php echo esc_url($band['src']); ?>')">
				<img src="<?php echo esc_url($band['src']); ?>" alt="" width="1600" height="320" decoding="async" fetchpriority="high">
			</figure>
		<?php endif; ?>
		<div class="ct-container pa-band__grid">
			<div>
				<p class="si-eyebrow si-eyebrow--ruled"><?php echo esc_html($p['eyebrow']); ?></p>
				<h1 class="pa-title"><?php echo esc_html($p['title']); ?></h1>
				<?php if ($p['standfirst']) : ?>
					<p class="pa-standfirst"><?php echo esc_html($p['standfirst']); ?></p>
				<?php endif; ?>
			</div>
			<?php if ($p['rows']) : ?>
				<dl class="pa-card">
					<?php foreach ($p['rows'] as $row) : ?>
						<div><dt><?php echo esc_html($row['label']); ?></dt><dd><?php echo $row['html']; // escaped in si_pavilion_data() ?></dd></div>
					<?php endforeach; ?>
				</dl>
			<?php endif; ?>
		</div>
		<?php if (!empty($band['caption'])) : ?>
			<p class="ct-container pa-photo__cap"><?php echo esc_html($band['caption']); ?></p>
		<?php endif; ?>
		<?php if ($p['children']) : ?>
			<nav class="ct-container pa-parts" aria-label="<?php esc_attr_e('Pages in this section', 'si'); ?>">
				<span><?php esc_html_e('In this section', 'si'); ?></span>
				<?php foreach ($p['children'] as $child) : ?>
					<a href="<?php echo esc_url($child['url']); ?>"><?php echo esc_html($child['title']); ?></a>
				<?php endforeach; ?>
			</nav>
		<?php endif; ?>
	</header>

	<?php if (count($p['marks']) >= 3) : ?>
		<nav class="pa-chapters" aria-label="<?php esc_attr_e('Sections', 'si'); ?>" data-si-chapters>
			<div class="ct-container"><ol>
				<?php foreach ($p['marks'] as $i => $mark) : ?>
					<li><a href="#<?php echo esc_attr($mark['id']); ?>"><span><?php echo esc_html(sprintf('%02d', $i + 1)); ?></span><?php echo esc_html($mark['text']); ?></a></li>
				<?php endforeach; ?>
			</ol></div>
		</nav>
	<?php endif; ?>

	<div class="pa-body si-prose<?php echo $single ? ' is-single' : ''; ?>">
		<?php foreach ($rooms as $i => $room) : ?>
			<section class="pa-room<?php echo $room['heading'] ? '' : ' is-vestibule'; ?><?php echo $i % 2 ? ' is-alt' : ''; ?>">
				<div class="ct-container pa-room__grid">
					<div class="pa-room__label"><?php if ($room['heading']) : ?><span class="pa-room__n"><?php echo esc_html(sprintf('%02d', $i + $numbered)); ?></span><?php echo $room['heading']; // the page's own heading ?><?php endif; ?></div>
					<div class="si-prose pa-room__content"><?php echo $room['html']; // the page's own rendered content ?></div>
				</div>
			</section>
		<?php endforeach; ?>
	</div>
</div>
