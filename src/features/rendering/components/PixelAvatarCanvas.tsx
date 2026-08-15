import { useEffect, useRef } from 'react'

import type { PixelRenderStyle } from '@/features/avatar/avatars'
import { paintPixelAvatar, type PixelAvatarFrame } from '@/features/rendering/pixelRenderer'
import type { RenderedPalette, RenderedScene } from '@/features/rendering/renderedScene'

export function StaticPixelAvatarCanvas({
  frame,
  style,
  className,
}: {
  frame: PixelAvatarFrame
  style: PixelRenderStyle
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    paintPixelAvatar(context, frame, style)
  }, [frame, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

export function LivePixelAvatarCanvas({
  scene,
  palette,
  style,
  className,
}: {
  scene: RenderedScene
  palette: RenderedPalette
  style: PixelRenderStyle
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    let frameRequest: number | null = null
    const readPaths = (paths: RenderedScene['backPaths']) => {
      const values: string[] = []
      paths.forEach(path => {
        const value = path.get()
        if (value) values.push(value)
      })
      return values
    }
    const paint = () => {
      frameRequest = null
      paintPixelAvatar(
        context,
        {
          headPath: scene.headPath.get(),
          backPaths: readPaths(scene.backPaths),
          frontPaths: readPaths(scene.frontPaths),
          leftPath: scene.leftPath.get(),
          rightPath: scene.rightPath.get(),
          leftOpacity: scene.leftOpacity.get(),
          rightOpacity: scene.rightOpacity.get(),
          offsetX: scene.offsetX.get(),
          offsetY: scene.offsetY.get(),
          bodyColor: palette.body.get(),
          eyeColor: palette.eyes.get(),
        },
        style
      )
    }
    const schedulePaint = () => {
      if (frameRequest === null) frameRequest = requestAnimationFrame(paint)
    }
    const values = [
      scene.headPath,
      ...scene.backPaths,
      ...scene.frontPaths,
      scene.leftPath,
      scene.rightPath,
      scene.leftOpacity,
      scene.rightOpacity,
      scene.offsetX,
      scene.offsetY,
      palette.body,
      palette.eyes,
    ]
    const unsubscribers = values.map(value => value.on('change', schedulePaint))
    paint()
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
    }
  }, [palette, scene, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
