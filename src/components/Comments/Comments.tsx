import { useEffect, useState } from 'react'
import { Avatar } from '@x-tech-laboratories/x-libs/web/react/media'
import { cx } from '@x-tech-laboratories/x-libs/web/dom'
import { pluginManager } from '../../plugins/manager'
import type { Comment as CommentType, CommentThread } from '../../plugins/types'
import './Comments.css'

interface CommentsProps {
  videoId: string
}

export default function Comments({ videoId }: CommentsProps) {
  const [thread, setThread] = useState<CommentThread | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const plugin = pluginManager.getActive()
    if (!plugin.getComments) { setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setThread(null)
    plugin
      .getComments(videoId)
      .then(t => { if (!cancelled) { setThread(t); setLoading(false) } })
      // Comments are optional — a failure shouldn't disturb the page.
      .catch(() => { if (!cancelled) { setThread(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [videoId])

  if (loading) return <p className="comments-status">Loading comments…</p>
  if (!thread || thread.comments.length === 0) {
    return <p className="comments-status">No comments.</p>
  }

  return (
    <section className="comments">
      <h2 className="comments-title">{thread.totalText || 'Comments'}</h2>
      <ul className="comments-list">
        {thread.comments.map(c => (
          <CommentRow key={c.commentId} videoId={videoId} comment={c} />
        ))}
      </ul>
    </section>
  )
}

/** One top-level comment, with its replies loaded on demand. */
function CommentRow({ videoId, comment }: { videoId: string; comment: CommentType }) {
  const [replies, setReplies] = useState<CommentType[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function toggleReplies() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (replies !== null) return

    const plugin = pluginManager.getActive()
    if (!plugin.getCommentReplies) { setReplies([]); return }

    setLoading(true)
    try {
      setReplies(await plugin.getCommentReplies(videoId, comment.commentId))
    } catch {
      setReplies([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="comment">
      <Avatar src={comment.authorAvatar} name={comment.author} />
      <div className="comment-body">
        <CommentHead comment={comment} />
        <p className="comment-text">{comment.text}</p>
        <p className="comment-meta">
          {comment.likeCount && <span>👍 {comment.likeCount}</span>}
          {comment.hasReplies && comment.replyCount && (
            <button type="button" className="link" onClick={toggleReplies}>
              {open ? 'Hide' : 'Show'} {comment.replyCount} replies
            </button>
          )}
        </p>

        {open && (
          loading
            ? <p className="comment-replies-status">Loading replies…</p>
            : replies && replies.length > 0
              ? (
                <ul className="comment-replies">
                  {replies.map(r => (
                    <li key={r.commentId} className="comment comment-reply">
                      <Avatar src={r.authorAvatar} name={r.author} size="small" />
                      <div className="comment-body">
                        <CommentHead comment={r} />
                        <p className="comment-text">{r.text}</p>
                        {r.likeCount && (
                          <p className="comment-meta"><span>👍 {r.likeCount}</span></p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )
              : <p className="comment-replies-status">No replies.</p>
        )}
      </div>
    </li>
  )
}

function CommentHead({ comment }: { comment: CommentType }) {
  return (
    <p className="comment-head">
      {comment.isPinned && <span className="comment-pin" title="Pinned">📌</span>}
      <span className={cx('comment-author', comment.authorIsOwner && 'comment-author-owner')}>
        {comment.author}
      </span>
      <span className="comment-date">{comment.publishedText}</span>
    </p>
  )
}
