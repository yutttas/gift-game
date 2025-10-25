import { useState } from 'react'
import './App.css'

interface PhotoBlock {
  id: number
  image: string
  x: number
  y: number
  width: number
  height: number
  comment: string
}

function App() {
  // ブロックデータ（登れる位置に配置）
  const [blocks] = useState<PhotoBlock[]>([
    { id: 1, image: '/photos/E7FD0545-D301-4DFD-9E05-C96EF8E6D22A.JPEG', x: 100, y: 500, width: 150, height: 100, comment: '自由記述' },
    { id: 2, image: '/photos/IMG_1027.HEIC', x: 300, y: 450, width: 150, height: 100, comment: '自由記述' },
    { id: 3, image: '/photos/IMG_2511.HEIC', x: 500, y: 400, width: 150, height: 100, comment: '自由記述' },
    { id: 4, image: '/photos/IMG_2719.HEIC', x: 700, y: 350, width: 150, height: 100, comment: '自由記述' },
    { id: 5, image: '/photos/IMG_2981.HEIC', x: 900, y: 300, width: 150, height: 100, comment: '自由記述' },
    { id: 6, image: '/photos/IMG_3079.jpg', x: 1100, y: 250, width: 150, height: 100, comment: '自由記述' },
    { id: 7, image: '/photos/IMG_3333.HEIC', x: 1300, y: 200, width: 150, height: 100, comment: '自由記述' },
    { id: 8, image: '/photos/IMG_3596.HEIC', x: 1500, y: 250, width: 150, height: 100, comment: '自由記述' },
    { id: 9, image: '/photos/IMG_3623.HEIC', x: 1700, y: 300, width: 150, height: 100, comment: '自由記述' },
    { id: 10, image: '/photos/IMG_3841.HEIC', x: 1900, y: 350, width: 150, height: 100, comment: '自由記述' },
    { id: 11, image: '/photos/IMG_3870.HEIC', x: 2100, y: 400, width: 150, height: 100, comment: '自由記述' },
    { id: 12, image: '/photos/IMG_4513.HEIC', x: 2300, y: 450, width: 150, height: 100, comment: '自由記述' },
    { id: 13, image: '/photos/IMG_5028.HEIC', x: 2500, y: 500, width: 150, height: 100, comment: '自由記述' },
    { id: 14, image: '/photos/IMG_7009.HEIC', x: 2700, y: 450, width: 150, height: 100, comment: '自由記述' },
    { id: 15, image: '/photos/IMG_7578 2.HEIC', x: 2900, y: 400, width: 150, height: 100, comment: '自由記述' },
    { id: 16, image: '/photos/IMG_9739.HEIC', x: 3100, y: 350, width: 150, height: 100, comment: '自由記述' },
  ])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#87CEEB',
      position: 'relative',
      overflow: 'auto'
    }}>
      {/* 地面 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '3500px',
        height: '50px',
        backgroundColor: '#8B4513'
      }} />

      {/* 画像ブロック */}
      {blocks.map((block) => (
        <div key={block.id} style={{
          position: 'absolute',
          left: block.x,
          top: block.y,
          width: block.width,
          height: block.height,
        }}>
          {/* 画像 */}
          <div style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${block.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '3px solid #333',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }} />

          {/* コメント欄 */}
          <div style={{
            position: 'absolute',
            top: block.height + 5,
            left: 0,
            width: '100%',
            fontSize: '12px',
            textAlign: 'center',
            color: '#333',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '4px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}>
            {block.comment}
          </div>
        </div>
      ))}
    </div>
  )
}

export default App
