import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function ChallengeProgress() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const progress = user?.progress || {
    challenge1: false,
    challenge2: false,
    challenge3: false
  };

  const getStepClass = (stepNum) => {
    const completed = stepNum === 1 ? progress.challenge1 :
      stepNum === 2 ? progress.challenge2 :
        progress.challenge3;

    const prevCompleted = stepNum === 1 ? true :
      stepNum === 2 ? progress.challenge1 :
        progress.challenge2;

    if (completed) return 'challenge-step completed';
    if (prevCompleted) return 'challenge-step active';
    return 'challenge-step locked';
  };

  return (
    <div className="challenge-progress">
      <div className={getStepClass(1)}>
        <div className="step-number">{progress.challenge1 ? '✓' : '01'}</div>
        <div className="step-title">{t('cryptography')}</div>
      </div>
      <div className={getStepClass(2)}>
        <div className="step-number">{progress.challenge2 ? '✓' : '02'}</div>
        <div className="step-title">{t('authentication')}</div>
      </div>
      <div className={getStepClass(3)}>
        <div className="step-number">{progress.challenge3 ? '✓' : '03'}</div>
        <div className="step-title">{t('authorization')}</div>
      </div>
    </div>
  );
}

export default ChallengeProgress;
