import React, { useEffect, useRef } from 'react';

interface WeatherAnimationsProps {
  condition: string;
}

export const WeatherAnimations: React.FC<WeatherAnimationsProps> = ({ condition }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Animation objects
    // 1. Rain drops
    interface RainDrop {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
    }
    const rainDrops: RainDrop[] = [];
    const initRain = () => {
      const density = condition === 'Stormy' ? 120 : 60;
      for (let i = 0; i < density; i++) {
        rainDrops.push({
          x: Math.random() * width,
          y: Math.random() * height - height,
          length: 10 + Math.random() * 25,
          speed: 15 + Math.random() * 15,
          opacity: 0.15 + Math.random() * 0.3,
        });
      }
    };

    // 2. Clouds
    interface Cloud {
      x: number;
      y: number;
      radius: number;
      speed: number;
      opacity: number;
    }
    const clouds: Cloud[] = [];
    const initClouds = () => {
      const count = 6;
      for (let i = 0; i < count; i++) {
        clouds.push({
          x: Math.random() * width,
          y: 50 + Math.random() * 150,
          radius: 40 + Math.random() * 80,
          speed: 0.2 + Math.random() * 0.5,
          opacity: 0.05 + Math.random() * 0.1,
        });
      }
    };

    // 3. Wind lines
    interface WindLine {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
    }
    const windLines: WindLine[] = [];
    const initWind = () => {
      const count = 15;
      for (let i = 0; i < count; i++) {
        windLines.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: 80 + Math.random() * 120,
          speed: 2 + Math.random() * 4,
          opacity: 0.05 + Math.random() * 0.1,
        });
      }
    };

    // Initialize animation assets
    if (condition === 'Rainy' || condition === 'Stormy') initRain();
    if (condition === 'Cloudy' || condition === 'Windy' || condition === 'Stormy') initClouds();
    if (condition === 'Windy') initWind();

    let sunAngle = 0;
    let lightningTimer = 0;
    let lightningFlash = false;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // --- SUNNY ANIMATION ---
      if (condition === 'Sunny') {
        sunAngle += 0.005;
        const sunX = width - 150;
        const sunY = 150;
        const maxRadius = 120 + Math.sin(sunAngle) * 15;

        // Glowing sun layers
        const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, maxRadius);
        grad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        grad.addColorStop(0.3, 'rgba(253, 224, 71, 0.15)');
        grad.addColorStop(0.6, 'rgba(253, 224, 71, 0.04)');
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, maxRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw sun core
        ctx.fillStyle = 'rgba(253, 224, 71, 0.6)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- CLOUDS ANIMATION (used in Cloudy, Stormy, Windy) ---
      if (condition === 'Cloudy' || condition === 'Stormy' || condition === 'Windy') {
        clouds.forEach((cloud) => {
          cloud.x += cloud.speed;
          if (cloud.x - cloud.radius > width) {
            cloud.x = -cloud.radius;
          }

          const grad = ctx.createRadialGradient(
            cloud.x,
            cloud.y,
            10,
            cloud.x,
            cloud.y,
            cloud.radius
          );
          const colorBase = condition === 'Stormy' ? '30, 32, 40' : '200, 205, 215';
          grad.addColorStop(0, `rgba(${colorBase}, ${cloud.opacity})`);
          grad.addColorStop(0.7, `rgba(${colorBase}, ${cloud.opacity * 0.5})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // --- WIND LINES ---
      if (condition === 'Windy') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        windLines.forEach((line) => {
          line.x += line.speed;
          if (line.x > width) {
            line.x = -line.length;
            line.y = Math.random() * height;
          }

          ctx.strokeStyle = `rgba(255, 255, 255, ${line.opacity})`;
          ctx.beginPath();
          ctx.moveTo(line.x, line.y);
          ctx.lineTo(line.x + line.length, line.y);
          ctx.stroke();
        });
      }

      // --- RAIN / STORMY RAIN ---
      if (condition === 'Rainy' || condition === 'Stormy') {
        ctx.strokeStyle = 'rgba(174, 207, 238, 0.5)';
        ctx.lineWidth = 1;

        rainDrops.forEach((drop) => {
          drop.y += drop.speed;
          drop.x += condition === 'Stormy' ? 2 : 0.5; // windy rain slant in storms

          if (drop.y > height) {
            drop.y = Math.random() * -50;
            drop.x = Math.random() * width;
          }

          ctx.strokeStyle = `rgba(174, 207, 238, ${drop.opacity})`;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          // slant coordinates
          ctx.lineTo(drop.x + (condition === 'Stormy' ? 4 : 1), drop.y + drop.length);
          ctx.stroke();
        });
      }

      // --- STORMY LIGHTNING FLASHES ---
      if (condition === 'Stormy') {
        lightningTimer++;
        if (lightningFlash) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(0, 0, width, height);
          lightningFlash = false;
        }

        // Trigger flash occasionally
        if (lightningTimer > 180 + Math.random() * 200) {
          lightningFlash = true;
          lightningTimer = 0;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [condition]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};
