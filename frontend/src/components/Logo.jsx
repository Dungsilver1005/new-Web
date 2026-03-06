import { useState } from "react";
import "./Logo.css";

/**
 * Component Logo
 * Hiển thị logo I-ToolSys
 * @param {boolean} collapsed - Trạng thái sidebar collapsed
 * @param {string} size - Kích thước: 'small', 'medium', 'large'
 */
export const Logo = ({ collapsed = false, size = "medium" }) => {
  const [imageError, setImageError] = useState(false);
  const logoPath = "/assets/logo.png"; // Đường dẫn logo trong public folder

  if (collapsed) {
    // Khi sidebar collapsed, vẫn hiển thị logo I-ToolSys thu gọn
    return (
      <div className="logo-container logo-collapsed">
        <div className="logo-wrapper">
          {!imageError ? (
            <img
              src={logoPath}
              alt="I-ToolSys Logo"
              className="logo-image logo-image-collapsed"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="logo-css-fallback logo-collapsed-fallback">
              <div className="logo-tools logo-tools-collapsed">
                <div className="tool tool-1 tool-collapsed">
                  <div className="tool-stripes"></div>
                </div>
                <div className="tool tool-2 tool-collapsed">
                  <div className="tool-stripes"></div>
                </div>
                <div className="tool tool-3 tool-collapsed">
                  <div className="tool-stripes"></div>
                </div>
              </div>
              <div className="logo-base logo-base-collapsed">
<<<<<<< HEAD
                <span className="logo-text logo-text-collapsed">I-TOOLSYS</span>
=======
                <span className="logo-text logo-text-collapsed">I-ToolSys</span>
>>>>>>> 29cff4b ( plc connected)
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`logo-container logo-${size}`}>
      <div className="logo-wrapper">
        {!imageError ? (
          // Thử load logo từ file trước
          <img
            src={logoPath}
              alt="I-ToolSys Logo"
            className="logo-image"
            onError={() => setImageError(true)}
          />
        ) : (
          // Logo CSS fallback dựa trên mô tả
          <div className="logo-css-fallback">
            <div className="logo-tools">
              <div className="tool tool-1">
                <div className="tool-stripes"></div>
              </div>
              <div className="tool tool-2">
                <div className="tool-stripes"></div>
              </div>
              <div className="tool tool-3">
                <div className="tool-stripes"></div>
              </div>
            </div>
            <div className="logo-base">
<<<<<<< HEAD
              <span className="logo-text">I-TOOLSYS</span>
=======
              <span className="logo-text">I-ToolSys</span>
>>>>>>> 29cff4b ( plc connected)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
