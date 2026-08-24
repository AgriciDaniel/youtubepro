import { ShootingStars } from "./shooting-stars";

export function StarryBackground() {
  return (
    <>
      {/* Static star field */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_70%)]" />
        <div className="stars absolute inset-0" />
      </div>

      {/* Subtle shooting stars - reduced opacity and fewer stars for main content areas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        <ShootingStars
          starColor="#FF0000"
          trailColor="#FF4444"
          minSpeed={12}
          maxSpeed={25}
          minDelay={2000}
          maxDelay={5000}
        />
        <ShootingStars
          starColor="#FFFFFF"
          trailColor="#FF0000"
          minSpeed={15}
          maxSpeed={30}
          minDelay={3000}
          maxDelay={6000}
        />
      </div>

      <style>{`
        .stars {
          background-image:
            radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.4), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.3), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.2), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.3), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.2), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.2), rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 200px 200px;
          animation: twinkle 8s ease-in-out infinite;
          opacity: 0.3;
        }

        @keyframes twinkle {
          0% { opacity: 0.2; }
          50% { opacity: 0.4; }
          100% { opacity: 0.2; }
        }
      `}</style>
    </>
  );
}
