import React from 'react'
import clsx from 'clsx'
import styles from './styles.module.css'
import ReactPlayer from 'react-player'

const FeatureList = [
  {
    title:
      'Download a sample configuration file to quick start using JBrowse 2 for cancer workflows',
    img: '../img/sv_inspector_importform_loaded.png',
    link: '/jb2/download',
    description:
      'Includes hg19 and hg38 as default assemblies, the plugins highlighted below, and some sample data for exemplar purposes.',
  },
  {
    title: 'Download the most recent version of JBrowse 2',
    img: '../img/multirow_bigwig.png',
    link: '/jb2/download',
    description: 'Available as a desktop application or web application.',
  },
]

function Feature({ img, title, link, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {/* eslint-disable-next-line react/jsx-no-target-blank*/}
        <a href={link} target="_blank">
          <img
            alt={`A screenshot of JBrowse`}
            className={styles.featureSvg}
            src={img}
            style={{
              borderRadius: '8px',
              border: '4px solid #e0e0e0',
              height: 'auto',
              width: '100%',
            }}
          />
        </a>
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function MiniFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <ReactPlayer
                style={{
                  borderRadius: '8px',
                  border: '4px solid #e0e0e0',
                  height: 'auto',
                  width: '100%',
                }}
                width={408}
                height={275}
                controls
                url="https://www.youtube.com/watch?v=rYqTYcZ56xs"
              />
            </div>
            <div className="text--center padding-horiz--md">
              <h3>Check out the video tutorial series</h3>
              <p>
                Also checkout our{' '}
                <a href="/jb2/docs/tutorials/user/guided_cancer_tutorial">
                  written guides
                </a>
                .
              </p>
            </div>
          </div>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
