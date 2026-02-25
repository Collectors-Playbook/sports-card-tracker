import React, { useState } from 'react';
import { ExtractedCardData } from '../../services/api';
import { CATEGORIES, GRADING_COMPANIES, getGradeScale, RAW_CONDITIONS } from '../../types';
import './CardReviewForm.css';

interface CardReviewFormProps {
  initialData: ExtractedCardData;
  imageUrls: { front?: string; back?: string };
  mode: 'review' | 'edit';
  cardId?: string;
  saving?: boolean;
  onSave: (data: ExtractedCardData) => void;
  onCancel: () => void;
}

const CardReviewForm: React.FC<CardReviewFormProps> = ({
  initialData,
  imageUrls,
  mode,
  saving = false,
  onSave,
  onCancel,
}) => {
  const [player, setPlayer] = useState(initialData.player || '');
  const [year, setYear] = useState(initialData.year || '');
  const [brand, setBrand] = useState(initialData.brand || '');
  const [setName, setSetName] = useState(initialData.setName || '');
  const [cardNumber, setCardNumber] = useState(initialData.cardNumber || '');
  const [team, setTeam] = useState(initialData.team || '');
  const [category, setCategory] = useState(initialData.category || 'Other');
  const [parallel, setParallel] = useState(initialData.parallel || '');
  const [serialNumber, setSerialNumber] = useState(initialData.serialNumber || '');
  const [gradingCompany, setGradingCompany] = useState(initialData.gradingCompany || '');
  const [grade, setGrade] = useState(initialData.grade || '');
  const [condition, setCondition] = useState(
    initialData.gradingCompany ? 'Graded' : (initialData.condition || 'Raw')
  );

  const handleGradingCompanyChange = (newCompany: string) => {
    setGradingCompany(newCompany);
    if (newCompany) {
      setCondition('Graded');
      const scale = getGradeScale(newCompany);
      const validValues = scale.map(g => g.value);
      if (grade && !validValues.includes(grade)) {
        setGrade('');
      }
    } else {
      setGrade('');
      setCondition('Raw');
    }
  };
  const [isRookie, setIsRookie] = useState(initialData.features?.isRookie ?? false);
  const [isAutograph, setIsAutograph] = useState(initialData.features?.isAutograph ?? false);
  const [isRelic, setIsRelic] = useState(initialData.features?.isRelic ?? false);
  const [isNumbered, setIsNumbered] = useState(initialData.features?.isNumbered ?? false);

  const confidence = initialData.confidence;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: ExtractedCardData = {
      player: player || undefined,
      year: year || undefined,
      brand: brand || undefined,
      setName: setName || undefined,
      cardNumber: cardNumber || undefined,
      team: team || undefined,
      category: category || undefined,
      parallel: parallel || undefined,
      serialNumber: serialNumber || undefined,
      gradingCompany: gradingCompany || undefined,
      grade: grade || undefined,
      features: {
        isRookie,
        isAutograph,
        isRelic,
        isNumbered,
        isGraded: !!(gradingCompany && grade),
        isParallel: !!parallel,
      },
      condition,
      confidence: initialData.confidence,
    };
    onSave(data);
  };

  return (
    <div className="card-review-overlay" onClick={onCancel}>
      <div className="card-review-modal" onClick={e => e.stopPropagation()}>
        <div className="card-review-header">
          <h3>{mode === 'review' ? 'Review Card Details' : 'Edit Card Details'}</h3>
          <button className="card-review-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card-review-body">
            {/* Image panel */}
            <div className="card-review-images">
              {imageUrls.front && (
                <div className="card-review-thumb-wrapper">
                  <img src={imageUrls.front} alt="Card front" />
                  <span className="card-review-thumb-label">Front</span>
                </div>
              )}
              {imageUrls.back && (
                <div className="card-review-thumb-wrapper">
                  <img src={imageUrls.back} alt="Card back" />
                  <span className="card-review-thumb-label">Back</span>
                </div>
              )}
              {mode === 'review' && confidence && (
                <div className="card-review-confidence">
                  Confidence:
                  <span className={`card-review-confidence-badge ${confidence.level}`}>
                    {confidence.score}%
                  </span>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="card-review-form">
              <div className="card-review-field">
                <label htmlFor="cr-player">Player Name</label>
                <input
                  id="cr-player"
                  type="text"
                  value={player}
                  onChange={e => setPlayer(e.target.value)}
                  placeholder="e.g. Mike Trout"
                />
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-year">Year</label>
                  <input
                    id="cr-year"
                    type="text"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    placeholder="e.g. 2023"
                  />
                </div>
                <div className="card-review-field">
                  <label htmlFor="cr-cardnumber">Card Number</label>
                  <input
                    id="cr-cardnumber"
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-brand">Brand / Manufacturer</label>
                  <input
                    id="cr-brand"
                    type="text"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    placeholder="e.g. Topps"
                  />
                </div>
                <div className="card-review-field">
                  <label htmlFor="cr-setname">Set Name</label>
                  <input
                    id="cr-setname"
                    type="text"
                    value={setName}
                    onChange={e => setSetName(e.target.value)}
                    placeholder="e.g. Chrome"
                  />
                </div>
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-team">Team</label>
                  <input
                    id="cr-team"
                    type="text"
                    value={team}
                    onChange={e => setTeam(e.target.value)}
                    placeholder="e.g. Angels"
                  />
                </div>
                <div className="card-review-field">
                  <label htmlFor="cr-category">Category</label>
                  <select
                    id="cr-category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-parallel">Parallel / Variant</label>
                  <input
                    id="cr-parallel"
                    type="text"
                    value={parallel}
                    onChange={e => setParallel(e.target.value)}
                    placeholder="e.g. Refractor"
                  />
                </div>
                <div className="card-review-field">
                  <label htmlFor="cr-serial">Serial Number</label>
                  <input
                    id="cr-serial"
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. 25/50"
                  />
                </div>
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-grading-company">Grading Company</label>
                  <select
                    id="cr-grading-company"
                    value={gradingCompany}
                    onChange={e => handleGradingCompanyChange(e.target.value)}
                  >
                    <option value="">None</option>
                    {GRADING_COMPANIES.map(gc => (
                      <option key={gc} value={gc}>{gc}</option>
                    ))}
                  </select>
                </div>
                <div className="card-review-field">
                  <label htmlFor="cr-grade">Grade</label>
                  {gradingCompany ? (
                    <select
                      id="cr-grade"
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                    >
                      <option value="">Select grade...</option>
                      {getGradeScale(gradingCompany).map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="cr-grade"
                      type="text"
                      value=""
                      disabled
                      placeholder="Select grading company first"
                    />
                  )}
                </div>
              </div>

              <div className="card-review-row">
                <div className="card-review-field">
                  <label htmlFor="cr-condition">Condition</label>
                  {gradingCompany ? (
                    <input
                      id="cr-condition"
                      type="text"
                      value="Graded"
                      disabled
                    />
                  ) : (
                    <select
                      id="cr-condition"
                      value={condition}
                      onChange={e => setCondition(e.target.value)}
                    >
                      {RAW_CONDITIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="card-review-row card-review-checkboxes">
                <label className="card-review-checkbox">
                  <input
                    type="checkbox"
                    checked={isRookie}
                    onChange={e => setIsRookie(e.target.checked)}
                  />
                  Rookie
                </label>
                <label className="card-review-checkbox">
                  <input
                    type="checkbox"
                    checked={isAutograph}
                    onChange={e => setIsAutograph(e.target.checked)}
                  />
                  Autograph
                </label>
                <label className="card-review-checkbox">
                  <input
                    type="checkbox"
                    checked={isRelic}
                    onChange={e => setIsRelic(e.target.checked)}
                  />
                  Relic
                </label>
                <label className="card-review-checkbox">
                  <input
                    type="checkbox"
                    checked={isNumbered}
                    onChange={e => setIsNumbered(e.target.checked)}
                  />
                  Numbered
                </label>
              </div>
            </div>
          </div>

          <div className="card-review-footer">
            <button type="button" className="card-review-btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="card-review-btn-save" disabled={saving}>
              {saving ? 'Saving...' : mode === 'review' ? 'Confirm & Process' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardReviewForm;
