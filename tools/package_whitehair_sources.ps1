param(
    [string]$GeneratedDirectory = 'C:/Users/zx304/.codex/generated_images/01a1b983-80ad-75c1-81b9-7f401620b7fe'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'game/asset/character/player/icon/source/whitehair'
$layers = Join-Path $root 'game/asset/character/player/icon/layers/whitehair'
$metadata = Join-Path $root 'metadata/character/layers/whitehair.json'
New-Item -ItemType Directory -Force -Path $source,$layers | Out-Null
$inputs = @{
    design = 'exec-362f7c46-7ffb-4daa-8b00-8e7fa1757041.png'
    turnaround = 'exec-dcebe8a7-97aa-4d24-884d-65a8599362a0.png'
    atlas = 'exec-60f03dbe-4720-449d-b859-9744d721a888.png'
}
Copy-Item -LiteralPath (Join-Path $GeneratedDirectory $inputs.design) -Destination (Join-Path $source 'approved-design.png')
Copy-Item -LiteralPath (Join-Path $GeneratedDirectory $inputs.turnaround) -Destination (Join-Path $source 'turnaround.png')
Copy-Item -LiteralPath (Join-Path $GeneratedDirectory $inputs.atlas) -Destination (Join-Path $layers 'layer-atlas.png')

# Mechanical image packaging only. Artwork and transparency come from imagegen.
# Bounds ignore almost-transparent fringes for registration, never for pixel removal.
function Get-AlphaBounds([System.Drawing.Bitmap]$bitmap, [System.Drawing.Rectangle]$rect) {
    $left=$rect.Right; $top=$rect.Bottom; $right=-1; $bottom=-1
    for($y=$rect.Top; $y -lt $rect.Bottom; $y++) {
        for($x=$rect.Left; $x -lt $rect.Right; $x++) {
            if($bitmap.GetPixel($x,$y).A -gt 16) {
                if($x -lt $left){$left=$x}; if($x -gt $right){$right=$x}
                if($y -lt $top){$top=$y}; if($y -gt $bottom){$bottom=$y}
            }
        }
    }
    if($right -lt 0){throw 'Empty source image region'}
    return [System.Drawing.Rectangle]::new($left,$top,$right-$left+1,$bottom-$top+1)
}
function Save-Crop([System.Drawing.Bitmap]$bitmap,[System.Drawing.Rectangle]$rect,[string]$destination) {
    $crop=$bitmap.Clone($rect,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {$crop.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)} finally {$crop.Dispose()}
}

$turn=[System.Drawing.Bitmap]::new((Join-Path $source 'turnaround.png'))
$atlas=[System.Drawing.Bitmap]::new((Join-Path $layers 'layer-atlas.png'))
try {
    $views=[ordered]@{}
    $directions=@('front','side','back')
    $bounds=@{}
    for($i=0;$i -lt 3;$i++) {
        $start=[int][Math]::Floor($i*$turn.Width/3)
        $end=[int][Math]::Floor(($i+1)*$turn.Width/3)
        $bounds[$directions[$i]]=Get-AlphaBounds $turn ([System.Drawing.Rectangle]::new($start,0,$end-$start,$turn.Height))
    }
    $maxHeight=($bounds.Values | Measure-Object -Property Height -Maximum).Maximum
    $scale=160.0/$maxHeight
    foreach($direction in $directions) {
        $folder=Join-Path $source $direction
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        $b=$bounds[$direction]
        # Keep a tiny unmodified alpha fringe around each complete figure.
        $crop=[System.Drawing.Rectangle]::new([Math]::Max(0,$b.X-3),[Math]::Max(0,$b.Y-3),$b.Width+6,$b.Height+6)
        Save-Crop $turn $crop (Join-Path $folder 'idle-source.png')
        $canvas=[System.Drawing.Bitmap]::new(320,320,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g=[System.Drawing.Graphics]::FromImage($canvas)
        try {
            $g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            # Foot center is measured from the bottommost 12% of the figure.
            $footLeft=$b.Right; $footRight=$b.Left
            for($y=[int]($b.Bottom-$b.Height*.12);$y -lt $b.Bottom;$y++) {
                for($x=$b.Left;$x -lt $b.Right;$x++) {
                    if($turn.GetPixel($x,$y).A -gt 16) {
                        $footLeft=[Math]::Min($footLeft,$x); $footRight=[Math]::Max($footRight,$x)
                    }
                }
            }
            $footX=($footLeft+$footRight+1)/2.0
            $footY=$b.Bottom
            $dest=[System.Drawing.RectangleF]::new([single](160+($crop.X-$footX)*$scale),[single](288+($crop.Y-$footY)*$scale),[single]($crop.Width*$scale),[single]($crop.Height*$scale))
            $srcRect=[System.Drawing.RectangleF]::new($crop.X,$crop.Y,$crop.Width,$crop.Height)
            $g.DrawImage($turn,$dest,$srcRect,[System.Drawing.GraphicsUnit]::Pixel)
            $canvas.Save((Join-Path $folder 'idle.png'),[System.Drawing.Imaging.ImageFormat]::Png)
            $views[$direction]=[ordered]@{
                neutral="asset/character/player/icon/source/whitehair/$direction/idle.png"
                high_resolution_neutral="asset/character/player/icon/source/whitehair/$direction/idle-source.png"
                source_crop=@($crop.X,$crop.Y,$crop.Width,$crop.Height)
                original_foot_pivot=@($footX,$footY)
                canonical_foot_pivot=@(160,288)
                uniform_scale=$scale
                parts=[ordered]@{}
            }
        } finally {$g.Dispose();$canvas.Dispose()}
    }

    $partNames=@('head','hair-tail','body','arm-left','arm-right','cloth-hem','legs','mantle')
    $atlasDirections=@('front','back','side')
    $cw=[int]($atlas.Width/4);$ch=[int]($atlas.Height/6)
    if($cw*4 -ne $atlas.Width -or $ch*6 -ne $atlas.Height){throw 'Atlas grid is not divisible'}
    for($vi=0;$vi -lt 3;$vi++) {
        $direction=$atlasDirections[$vi]
        $folder=Join-Path $layers "$direction/source"
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        for($pi=0;$pi -lt 8;$pi++) {
            $name=$partNames[$pi]
            $rect=[System.Drawing.Rectangle]::new(($pi%4)*$cw,($vi*2+[Math]::Floor($pi/4))*$ch,$cw,$ch)
            Save-Crop $atlas $rect (Join-Path $folder "$name.png")
            $partBounds=Get-AlphaBounds $atlas $rect
            $views[$direction].parts[$name]=[ordered]@{
                file="asset/character/player/icon/layers/whitehair/$direction/source/$name.png"
                atlas_rect=@($rect.X,$rect.Y,$rect.Width,$rect.Height)
                alpha_bounds=@(($partBounds.X-$rect.X),($partBounds.Y-$rect.Y),$partBounds.Width,$partBounds.Height)
                status='independently_drawn_draft_not_registered'
                border_review_required=($partBounds.X -le $rect.X+1 -or $partBounds.Y -le $rect.Y+1 -or $partBounds.Right -ge $rect.Right-1 -or $partBounds.Bottom -ge $rect.Bottom-1)
            }
        }
    }
    $record=[ordered]@{
        id='whitehair'
        version=1
        status='draft_layers_not_applied'
        source_design='asset/character/player/icon/source/whitehair/approved-design.png'
        turnaround='asset/character/player/icon/source/whitehair/turnaround.png'
        atlas='asset/character/player/icon/layers/whitehair/layer-atlas.png'
        cell_size=@(320,320)
        pivot=@(160,288)
        neutral_target_max_visible_height=160
        runtime_registered=$false
        motion_ready=$false
        layer_assembly_validated=$false
        generation_record='metadata/character/whitehair-generation.json'
        notes=@(
            'Original imagegen outputs retained byte-for-byte; no background algorithm or repainting applied.',
            'Neutral sprites are whole-figure crops with one uniform scale shared across three directions.',
            'Parts were independently drawn in an atlas and mechanically extracted as full grid cells.',
            'Draft part scale, depth order, pivots, hidden joins, and motion have not been registered or validated.',
            'Neutral images come from the approved turnaround, not from an asserted matching assembly of draft parts.',
            'No job, weapon, attack, skill, deployment cost, or runtime character slot has been assigned.'
        )
        source_hashes=[ordered]@{
            approved_design=(Get-FileHash -LiteralPath (Join-Path $source 'approved-design.png') -Algorithm SHA256).Hash.ToLower()
            turnaround=(Get-FileHash -LiteralPath (Join-Path $source 'turnaround.png') -Algorithm SHA256).Hash.ToLower()
            layer_atlas=(Get-FileHash -LiteralPath (Join-Path $layers 'layer-atlas.png') -Algorithm SHA256).Hash.ToLower()
        }
        views=$views
    }
    $json=$record | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($metadata,$json+"`n",[System.Text.UTF8Encoding]::new($false))
    Write-Output ("Packed 3 neutral views and 24 independently drawn draft source parts. Shared scale: "+$scale)
} finally {$turn.Dispose();$atlas.Dispose()}
