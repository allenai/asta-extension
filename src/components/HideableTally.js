import React, { useState } from 'react'

import styles from '../styles/HideableTally.css'
import Icon from './Icon'

const HideableTally = ({
  children,
  hide = false,
  clickFn = () => {}
}) => {
  const [show, setShow] = useState(!hide)

  const handleClick = () => {
    setShow(!show)
    clickFn()
  }

  return (
    <div className={styles.tally}>
      {show
        ? (
          <>
            {children}
            <div className={styles.hideContainer} onClick={handleClick}>
              <div className={styles.openingArrow}><Icon type='openingArrow' /></div>
              <div>hide</div>
            </div>
          </>
          )
        : (
          <div className={styles.logoContainer} onClick={handleClick} style={{ padding:'8px 8px 8px 0' }}>
            <div className={styles.closingArrow}>
              <Icon type='closingCaret' />
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="36" height="36" fill="#fff">
              <path d="M19.2978 18.6736H9.64892V9.57002H17.4165C18.4536 9.57002 19.2978 8.73267 19.2978 7.70407V0H28.4764V9.57002C28.4764 14.5988 24.368 18.6736 19.2978 18.6736ZM9.64892 19.6065H0V28.7101H7.76758C8.80467 28.7101 9.64892 29.5474 9.64892 30.576V38.2801H18.8275V28.7101C18.8275 23.6813 14.7191 19.6065 9.64892 19.6065ZM40.477 19.14C39.4399 19.14 38.5957 18.3027 38.5957 17.2741V9.57002H29.4171V19.14C29.4171 24.1688 33.5255 28.2436 38.5957 28.2436H48.2446V19.14H40.477ZM19.7682 38.2801V47.8501H28.9468V40.146C28.9468 39.1174 29.791 38.2801 30.8281 38.2801H38.5957V29.1766H28.9468C23.8766 29.1766 19.7682 33.2513 19.7682 38.2801Z" fill="#F0529C"/>
            </svg>
          </div>
          )}
    </div>
  )
}

export default HideableTally
